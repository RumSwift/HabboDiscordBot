import { randomUUID } from 'node:crypto';
import { WithTransaction, IsDuplicateKeyError } from '../Database/DatabaseConnection.js';
import { AuditActionTypes } from '../Repositories/HabboLinkAuditRepository.js';
import { ChallengeStatuses } from '../Repositories/VerificationChallengeRepository.js';
import { RoleOperationTypes } from '../Repositories/RoleOperationRepository.js';
import { LogChannelTypes } from '../Repositories/GuildConfigurationRepository.js';
import { GetHotel } from '../Utils/HotelConfiguration.js';

export const LinkSources = Object.freeze({ Verification: 'VERIFICATION' });

export const LinkOutcomes = Object.freeze({
    Linked: 'LINKED',
    Unlinked: 'UNLINKED',
    AlreadyLinkedElsewhere: 'ALREADY_LINKED_ELSEWHERE',
    ChallengeNotCheckable: 'CHALLENGE_NOT_CHECKABLE',
    ChallengeExpired: 'CHALLENGE_EXPIRED',
    NoActiveLink: 'NO_ACTIVE_LINK',
    LinkChanged: 'LINK_CHANGED',
    GameRequired: 'GAME_REQUIRED',
});

class LinkAbort extends Error {
    constructor(Outcome) {
        super(Outcome);
        this.Outcome = Outcome;
    }
}

export class HabboLinkService {
    constructor({ Pool, LinkRepository, AuditRepository, NotificationRepository, RoleOperationRepository, ChallengeRepository, GuildConfigurationRepository, Logger, Clock = () => new Date() }) {
        this.Pool = Pool;
        this.LinkRepository = LinkRepository;
        this.AuditRepository = AuditRepository;
        this.NotificationRepository = NotificationRepository;
        this.RoleOperationRepository = RoleOperationRepository;
        this.ChallengeRepository = ChallengeRepository;
        this.GuildConfigurationRepository = GuildConfigurationRepository;
        this.Logger = Logger;
        this.Clock = Clock;
    }

    async CompleteVerifiedLink({ ChallengeId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode }) {
        const Game = GetHotel(HotelCode).Game;
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
                const PreviousLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId, Game, Connection, { ForUpdate: true });

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

                const NewLinkId = await this.LinkRepository.InsertLink(
                    { DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, Game, LinkedTimestamp: Now, LinkSource: LinkSources.Verification, OperationId },
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

                if (PreviousLink && PreviousLink.HotelCode !== HotelCode) {
                    await this.QueueRoleOperations(Connection, { OperationId, Link: PreviousLink, OperationType: RoleOperationTypes.Remove, Now });
                }
                await this.QueueRoleOperations(Connection, { OperationId, Link: NewLink, OperationType: RoleOperationTypes.Add, Now });

                return { Outcome: LinkOutcomes.Linked, NewLink, PreviousLink, OperationId };
            });
        } catch (LinkError) {
            if (LinkError instanceof LinkAbort) {
                return { Outcome: LinkError.Outcome };
            }
            if (IsDuplicateKeyError(LinkError)) {
                return { Outcome: LinkOutcomes.AlreadyLinkedElsewhere };
            }
            throw LinkError;
        }
    }

    async UnlinkDiscordUser({ DiscordUserId, Game = null, ExpectedLinkId = null, Source = 'DISCORD', Reason = null }) {
        try {
            return await WithTransaction(this.Pool, async (Connection) => {
                const Now = this.Clock();
                const ActiveLinks = await this.LinkRepository.FindActiveLinksByDiscordUserId(DiscordUserId, Connection, { ForUpdate: true });
                const Candidates = Game ? ActiveLinks.filter((Link) => Link.Game === Game) : ActiveLinks;

                let ActiveLink;
                if (ExpectedLinkId !== null) {
                    ActiveLink = Candidates.find((Link) => String(Link.LinkId) === String(ExpectedLinkId));
                    if (!ActiveLink) {
                        throw new LinkAbort(Candidates.length === 0 ? LinkOutcomes.NoActiveLink : LinkOutcomes.LinkChanged);
                    }
                } else if (Candidates.length === 0) {
                    throw new LinkAbort(LinkOutcomes.NoActiveLink);
                } else if (Candidates.length > 1) {
                    throw new LinkAbort(LinkOutcomes.GameRequired);
                } else {
                    ActiveLink = Candidates[0];
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

                await this.QueueRoleOperations(Connection, { OperationId, Link: ActiveLink, OperationType: RoleOperationTypes.Remove, Now });
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

    async QueueRoleRestore(DiscordUserId, GuildId) {
        const Guild = await this.GuildConfigurationRepository.FindGuildByGuildId(GuildId);
        if (!Guild) {
            return null;
        }
        const ActiveLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId, Guild.GuildType);
        if (ActiveLink) {
            await this.QueueRoleOperations(this.Pool, { OperationId: randomUUID(), Link: ActiveLink, OperationType: RoleOperationTypes.Add, Now: this.Clock(), GuildId });
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
        const Channels = await this.GuildConfigurationRepository.GetLogChannels(LogChannelTypes.Verification, Connection);
        if (Channels.length === 0) {
            this.Logger?.Warn('No verification log channels configured; this event will not be posted', { AuditLogId });
        }
        for (const Channel of Channels) {
            await this.NotificationRepository.InsertPendingNotification(AuditLogId, Channel.ChannelId, EventTimestamp, Connection);
        }
        return AuditLogId;
    }

    async QueueRoleOperations(Connection, { OperationId, Link, OperationType, Now, GuildId = null }) {
        const Hotel = GetHotel(Link.HotelCode);
        const Roles = (await this.GuildConfigurationRepository.GetRoles(Hotel.Game, Hotel.RoleType, Connection)).filter(
            (Role) => GuildId === null || Role.GuildId === GuildId,
        );
        if (Roles.length === 0) {
            this.Logger?.Warn('No Discord role configured for hotel; skipping role change', { HotelCode: Link.HotelCode, OperationType });
            return;
        }
        for (const Role of Roles) {
            await this.RoleOperationRepository.InsertRoleOperation(
                { OperationId, LinkId: Link.LinkId, DiscordUserId: Link.DiscordUserId, HotelCode: Link.HotelCode, RoleId: Role.RoleId, GuildId: Role.GuildId, OperationType, Now },
                Connection,
            );
        }
    }
}
