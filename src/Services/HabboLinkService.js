import { randomUUID } from 'node:crypto';
import { WithTransaction, IsDuplicateKeyError } from '../Database/DatabaseConnection.js';
import { AuditActionTypes } from '../Repositories/HabboLinkAuditRepository.js';
import { ChallengeStatuses } from '../Repositories/VerificationChallengeRepository.js';
import { RoleOperationTypes } from '../Repositories/RoleOperationRepository.js';

export const LinkSources = Object.freeze({ Verification: 'VERIFICATION' });

export const LinkOutcomes = Object.freeze({
    Linked: 'LINKED',
    Unlinked: 'UNLINKED',
    AlreadyLinkedElsewhere: 'ALREADY_LINKED_ELSEWHERE',
    ChallengeNotCheckable: 'CHALLENGE_NOT_CHECKABLE',
    ChallengeExpired: 'CHALLENGE_EXPIRED',
    NoActiveLink: 'NO_ACTIVE_LINK',
    LinkChanged: 'LINK_CHANGED',
});

class LinkAbort extends Error {
    constructor(Outcome) {
        super(Outcome);
        this.Outcome = Outcome;
    }
}

export class HabboLinkService {
    constructor({ Pool, LinkRepository, AuditRepository, NotificationRepository, RoleOperationRepository, ChallengeRepository, HotelRoleIds, Logger, Clock = () => new Date() }) {
        this.Pool = Pool;
        this.LinkRepository = LinkRepository;
        this.AuditRepository = AuditRepository;
        this.NotificationRepository = NotificationRepository;
        this.RoleOperationRepository = RoleOperationRepository;
        this.ChallengeRepository = ChallengeRepository;
        this.HotelRoleIds = HotelRoleIds;
        this.Logger = Logger;
        this.Clock = Clock;
    }

    async CompleteVerifiedLink({ ChallengeId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode }) {
        try {
            return await WithTransaction(this.Pool, async (Connection) => {
                const Now = this.Clock();

                const Challenge = await this.ChallengeRepository.FindChallengeById(ChallengeId, Connection, { ForUpdate: true });
                if (!Challenge || Challenge.DiscordUserId !== DiscordUserId || Challenge.Status !== ChallengeStatuses.Checking) {
                    throw new LinkAbort(LinkOutcomes.ChallengeNotCheckable);
                }
                if (Challenge.ExpiresTimestamp <= Now) {
                    throw new LinkAbort(LinkOutcomes.ChallengeExpired);
                }

                const CurrentOwner = await this.LinkRepository.FindActiveLinkByHabboAccount(HotelCode, HabboUniqueId, Connection, { ForUpdate: true });
                if (CurrentOwner && CurrentOwner.DiscordUserId !== DiscordUserId) {
                    throw new LinkAbort(LinkOutcomes.AlreadyLinkedElsewhere);
                }

                const OperationId = randomUUID();
                const PreviousLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId, Connection, { ForUpdate: true });

                if (PreviousLink) {
                    await this.LinkRepository.MarkLinkUnlinked(PreviousLink.LinkId, DiscordUserId, Now, Connection);
                    await this.RecordAuditEvent(Connection, {
                        OperationId,
                        Link: PreviousLink,
                        ActionType: AuditActionTypes.Unlinked,
                        EventTimestamp: Now,
                        Details: { Reason: 'REPLACED' },
                    });
                }

                // The unique indexes make a concurrent duplicate impossible.
                const NewLinkId = await this.LinkRepository.InsertLink(
                    { DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, LinkedTimestamp: Now, LinkSource: LinkSources.Verification, OperationId },
                    Connection,
                );
                const NewLink = await this.LinkRepository.FindLinkById(NewLinkId, Connection);

                await this.RecordAuditEvent(Connection, {
                    OperationId,
                    Link: NewLink,
                    ActionType: AuditActionTypes.Linked,
                    EventTimestamp: Now,
                    Details: PreviousLink
                        ? { Source: LinkSources.Verification, PreviousLinkId: PreviousLink.LinkId, PreviousHabboUsername: PreviousLink.HabboUsername, PreviousHotelCode: PreviousLink.HotelCode }
                        : { Source: LinkSources.Verification },
                });

                await this.ChallengeRepository.TransitionStatus(ChallengeId, [ChallengeStatuses.Checking], ChallengeStatuses.Completed, Now, Connection);
                await this.ChallengeRepository.CloseOpenChallengesForUser(DiscordUserId, ChallengeStatuses.Superseded, Now, Connection);

                // Do not remove a role we are about to add again.
                if (PreviousLink && PreviousLink.HotelCode !== HotelCode) {
                    await this.QueueRoleOperation(Connection, { OperationId, Link: PreviousLink, OperationType: RoleOperationTypes.Remove, Now });
                }
                await this.QueueRoleOperation(Connection, { OperationId, Link: NewLink, OperationType: RoleOperationTypes.Add, Now });

                return { Outcome: LinkOutcomes.Linked, NewLink, PreviousLink, OperationId };
            });
        } catch (LinkError) {
            if (LinkError instanceof LinkAbort) {
                return { Outcome: LinkError.Outcome };
            }
            if (IsDuplicateKeyError(LinkError)) {
                // Another request linked this Habbo account (or this user) at the same moment.
                return { Outcome: LinkOutcomes.AlreadyLinkedElsewhere };
            }
            throw LinkError;
        }
    }

    async UnlinkDiscordUser({ DiscordUserId, ExpectedLinkId = null, Source = 'DISCORD', Reason = null }) {
        try {
            return await WithTransaction(this.Pool, async (Connection) => {
                const Now = this.Clock();
                const ActiveLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId, Connection, { ForUpdate: true });
                if (!ActiveLink) {
                    throw new LinkAbort(LinkOutcomes.NoActiveLink);
                }
                if (ExpectedLinkId !== null && String(ActiveLink.LinkId) !== String(ExpectedLinkId)) {
                    throw new LinkAbort(LinkOutcomes.LinkChanged);
                }

                const OperationId = randomUUID();
                const WasUpdated = await this.LinkRepository.MarkLinkUnlinked(ActiveLink.LinkId, DiscordUserId, Now, Connection);
                if (!WasUpdated) {
                    throw new LinkAbort(LinkOutcomes.NoActiveLink);
                }

                const Details = { Source };
                if (Reason) {
                    Details.Reason = String(Reason).slice(0, 200);
                }
                const AuditLogId = await this.RecordAuditEvent(Connection, {
                    OperationId,
                    Link: ActiveLink,
                    ActionType: AuditActionTypes.Unlinked,
                    EventTimestamp: Now,
                    Details,
                });

                await this.QueueRoleOperation(Connection, { OperationId, Link: ActiveLink, OperationType: RoleOperationTypes.Remove, Now });
                await this.ChallengeRepository.CloseOpenChallengesForUser(DiscordUserId, ChallengeStatuses.Cancelled, Now, Connection);

                return { Outcome: LinkOutcomes.Unlinked, Link: ActiveLink, UnlinkedTimestamp: Now, OperationId, AuditLogId };
            });
        } catch (LinkError) {
            if (LinkError instanceof LinkAbort) {
                return { Outcome: LinkError.Outcome };
            }
            throw LinkError;
        }
    }

    async QueueRoleRestore(DiscordUserId) {
        const ActiveLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId);
        if (ActiveLink) {
            await this.QueueRoleOperation(this.Pool, { OperationId: randomUUID(), Link: ActiveLink, OperationType: RoleOperationTypes.Add, Now: this.Clock() });
        }
        return ActiveLink;
    }

    async RecordAuditEvent(Connection, { OperationId, Link, ActionType, EventTimestamp, Details }) {
        const AuditLogId = await this.AuditRepository.InsertAuditEvent(
            {
                OperationId,
                LinkId: Link.LinkId,
                DiscordUserId: Link.DiscordUserId,
                HabboUniqueId: Link.HabboUniqueId,
                HabboUsername: Link.HabboUsername,
                HotelCode: Link.HotelCode,
                ActionType,
                EventTimestamp,
                Details,
            },
            Connection,
        );
        await this.NotificationRepository.InsertPendingNotification(AuditLogId, EventTimestamp, Connection);
        return AuditLogId;
    }

    async QueueRoleOperation(Connection, { OperationId, Link, OperationType, Now }) {
        const RoleId = this.HotelRoleIds[Link.HotelCode];
        if (!RoleId) {
            this.Logger?.Warn('No Discord role configured for hotel; skipping role change', { HotelCode: Link.HotelCode, OperationType });
            return;
        }
        await this.RoleOperationRepository.InsertRoleOperation(
            { OperationId, LinkId: Link.LinkId, DiscordUserId: Link.DiscordUserId, HotelCode: Link.HotelCode, RoleId, OperationType, Now },
            Connection,
        );
    }
}
