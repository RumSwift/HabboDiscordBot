import { randomUUID } from 'node:crypto';
import { WithTransaction } from '../Database/DatabaseConnection.js';
import { ChallengeStatuses } from '../Repositories/VerificationChallengeRepository.js';
import { HabboLookupStatuses } from './HabboApiService.js';
import { LinkOutcomes } from './HabboLinkService.js';
import { GenerateVerificationCode } from '../Utils/VerificationCodeGenerator.js';
import { HashVerificationCode, VerifyCodeHash } from '../Utils/VerificationCodeHasher.js';
import { IsValidHotelCode } from '../Utils/HotelConfiguration.js';
import { RateLimiter } from '../Utils/RateLimiter.js';

export const VerificationOutcomes = Object.freeze({
    ChallengeCreated: 'CHALLENGE_CREATED',
    InvalidUsername: 'INVALID_USERNAME',
    InvalidHotel: 'INVALID_HOTEL',
    AccountNotFound: 'ACCOUNT_NOT_FOUND',
    ServiceUnavailable: 'SERVICE_UNAVAILABLE',
    AlreadyLinkedElsewhere: 'ALREADY_LINKED_ELSEWHERE',
    AlreadyLinkedToYou: 'ALREADY_LINKED_TO_YOU',
    RateLimited: 'RATE_LIMITED',
    ChallengeNotFound: 'CHALLENGE_NOT_FOUND',
    ChallengeClosed: 'CHALLENGE_CLOSED',
    CheckInProgress: 'CHECK_IN_PROGRESS',
    Expired: 'EXPIRED',
    MottoUnavailable: 'MOTTO_UNAVAILABLE',
    Mismatch: 'MISMATCH',
    Failed: 'FAILED',
    Verified: 'VERIFIED',
    Cancelled: 'CANCELLED',
});

export const MaxUsernameLength = 64;

// Abuse protection: limits per Discord user.
const MaxChallengesPerWindow = 5;
const ChallengeWindowMinutes = 15;
const MaxHabboLookupsPerMinute = 10;

export class VerificationService {
    constructor({ Pool, HabboApiService, HabboLinkService, ChallengeRepository, LinkRepository, VerificationConfig, Logger, Clock = () => new Date() }) {
        this.Pool = Pool;
        this.HabboApiService = HabboApiService;
        this.HabboLinkService = HabboLinkService;
        this.ChallengeRepository = ChallengeRepository;
        this.LinkRepository = LinkRepository;
        this.Config = VerificationConfig;
        this.Logger = Logger;
        this.Clock = Clock;
        this.LookupRateLimiter = new RateLimiter({ Limit: MaxHabboLookupsPerMinute, WindowMs: 60000, Clock: () => this.Clock().getTime() });
    }

    async StartChallenge({ DiscordUserId, HotelCode, Username }) {
        const TrimmedUsername = String(Username ?? '').trim();
        if (TrimmedUsername.length === 0 || TrimmedUsername.length > MaxUsernameLength) {
            return { Outcome: VerificationOutcomes.InvalidUsername };
        }
        if (!IsValidHotelCode(HotelCode)) {
            return { Outcome: VerificationOutcomes.InvalidHotel };
        }
        if (!this.LookupRateLimiter.TryConsume(DiscordUserId)) {
            return { Outcome: VerificationOutcomes.RateLimited };
        }

        const WindowStart = new Date(this.Clock().getTime() - ChallengeWindowMinutes * 60000);
        const RecentChallengeCount = await this.ChallengeRepository.CountChallengesCreatedSince(DiscordUserId, WindowStart);
        if (RecentChallengeCount >= MaxChallengesPerWindow) {
            return { Outcome: VerificationOutcomes.RateLimited };
        }

        const Lookup = await this.HabboApiService.LookupUserByName(HotelCode, TrimmedUsername);
        if (Lookup.Status === HabboLookupStatuses.NotFound) {
            return { Outcome: VerificationOutcomes.AccountNotFound };
        }
        if (Lookup.Status !== HabboLookupStatuses.Found) {
            return { Outcome: VerificationOutcomes.ServiceUnavailable, Reason: Lookup.Reason, RetryAfterSeconds: Lookup.RetryAfterSeconds };
        }

        const Account = Lookup.Account;
        const CurrentOwner = await this.LinkRepository.FindActiveLinkByHabboAccount(HotelCode, Account.HabboUniqueId);
        if (CurrentOwner && CurrentOwner.DiscordUserId !== DiscordUserId) {
            return { Outcome: VerificationOutcomes.AlreadyLinkedElsewhere, Account };
        }
        if (CurrentOwner && CurrentOwner.DiscordUserId === DiscordUserId) {
            return { Outcome: VerificationOutcomes.AlreadyLinkedToYou, Account };
        }

        const Now = this.Clock();
        const VerificationCode = GenerateVerificationCode({ Prefix: this.Config.CodePrefix, Length: this.Config.CodeLength });
        const Challenge = {
            ChallengeId: randomUUID(),
            DiscordUserId,
            HabboUniqueId: Account.HabboUniqueId,
            HabboUsername: Account.Username,
            HotelCode,
            VerificationCodeHash: HashVerificationCode(VerificationCode, this.Config.CodeSecret),
            CreatedTimestamp: Now,
            ExpiresTimestamp: new Date(Now.getTime() + this.Config.ExpiryMinutes * 60000),
            FailedAttemptCount: 0,
            Status: ChallengeStatuses.Active,
        };

        // Only one open challenge per user: close the old one and insert the new one together.
        await WithTransaction(this.Pool, async (Connection) => {
            await this.ChallengeRepository.CloseOpenChallengesForUser(DiscordUserId, ChallengeStatuses.Superseded, Now, Connection);
            await this.ChallengeRepository.InsertChallenge(Challenge, Connection);
        });

        this.Logger?.Info('Verification challenge created', { DiscordUserId, HotelCode, ChallengeId: Challenge.ChallengeId });
        return { Outcome: VerificationOutcomes.ChallengeCreated, Challenge, VerificationCode, Account };
    }

    async CheckMotto({ DiscordUserId, ChallengeId }) {
        const Challenge = await this.ChallengeRepository.FindChallengeById(ChallengeId);
        if (!Challenge || Challenge.DiscordUserId !== DiscordUserId) {
            return { Outcome: VerificationOutcomes.ChallengeNotFound };
        }

        const Now = this.Clock();
        if (Challenge.Status === ChallengeStatuses.Active && Challenge.ExpiresTimestamp <= Now) {
            await this.ExpireChallenge(ChallengeId);
            return { Outcome: VerificationOutcomes.Expired, Challenge };
        }
        if (Challenge.Status === ChallengeStatuses.Checking) {
            return { Outcome: VerificationOutcomes.CheckInProgress, Challenge };
        }
        if (Challenge.Status !== ChallengeStatuses.Active) {
            return this.ClosedOutcome(Challenge);
        }
        if (!this.LookupRateLimiter.TryConsume(DiscordUserId)) {
            return { Outcome: VerificationOutcomes.RateLimited, Challenge };
        }

        // Claim the challenge so a double-click cannot process it twice.
        const Claimed = await this.ChallengeRepository.TryBeginCheck(ChallengeId, DiscordUserId, Now);
        if (!Claimed) {
            const Latest = await this.ChallengeRepository.FindChallengeById(ChallengeId);
            if (Latest?.Status === ChallengeStatuses.Checking) {
                return { Outcome: VerificationOutcomes.CheckInProgress, Challenge: Latest };
            }
            if (Latest?.Status === ChallengeStatuses.Active) {
                if (Latest.ExpiresTimestamp <= this.Clock()) {
                    await this.ExpireChallenge(ChallengeId);
                    return { Outcome: VerificationOutcomes.Expired, Challenge: Latest };
                }
                // A concurrent check finished between our claim and this read; it handled the click.
                return { Outcome: VerificationOutcomes.CheckInProgress, Challenge: Latest };
            }
            return this.ClosedOutcome(Latest ?? Challenge);
        }

        try {
            return await this.CheckClaimedChallenge(Challenge);
        } catch (CheckError) {
            // Something unexpected (e.g. database error). Give the attempt back.
            await this.ChallengeRepository.ReleaseCheck(ChallengeId, this.Clock()).catch(() => {});
            throw CheckError;
        }
    }

    async CheckClaimedChallenge(Challenge) {
        const { ChallengeId, DiscordUserId } = Challenge;

        // Always fetch a fresh motto, by unique ID, never reusing the first lookup.
        const Lookup = await this.HabboApiService.LookupUserByUniqueId(Challenge.HotelCode, Challenge.HabboUniqueId);

        // Problems on Habbo's side must NOT consume an attempt.
        if (Lookup.Status === HabboLookupStatuses.Unavailable) {
            await this.ChallengeRepository.ReleaseCheck(ChallengeId, this.Clock());
            return { Outcome: VerificationOutcomes.ServiceUnavailable, Reason: Lookup.Reason, RetryAfterSeconds: Lookup.RetryAfterSeconds, Challenge };
        }
        if (Lookup.Status === HabboLookupStatuses.NotFound) {
            await this.ChallengeRepository.ReleaseCheck(ChallengeId, this.Clock());
            return { Outcome: VerificationOutcomes.AccountNotFound, Challenge };
        }
        if (Lookup.Account.Motto === null) {
            await this.ChallengeRepository.ReleaseCheck(ChallengeId, this.Clock());
            return { Outcome: VerificationOutcomes.MottoUnavailable, Challenge };
        }

        // Exact, case-sensitive comparison (via constant-time HMAC comparison).
        const IsMatch = VerifyCodeHash(Lookup.Account.Motto, Challenge.VerificationCodeHash, this.Config.CodeSecret);

        if (!IsMatch) {
            const Updated = await this.ChallengeRepository.RecordFailedAttempt(ChallengeId, this.Config.MaxAttempts, this.Clock());
            if (!Updated) {
                // The challenge was cancelled/expired while we were checking.
                const Latest = await this.ChallengeRepository.FindChallengeById(ChallengeId);
                return this.ClosedOutcome(Latest ?? Challenge);
            }
            if (Updated.Status === ChallengeStatuses.Failed) {
                this.Logger?.Info('Verification failed: attempts exhausted', { DiscordUserId, ChallengeId });
                return { Outcome: VerificationOutcomes.Failed, Challenge: Updated };
            }
            return {
                Outcome: VerificationOutcomes.Mismatch,
                RemainingAttempts: this.Config.MaxAttempts - Updated.FailedAttemptCount,
                Challenge: Updated,
            };
        }

        // Motto matches: commit the link (re-checks status, expiry and ownership in a transaction).
        const LinkResult = await this.HabboLinkService.CompleteVerifiedLink({
            ChallengeId,
            DiscordUserId,
            HabboUniqueId: Challenge.HabboUniqueId,
            HabboUsername: Lookup.Account.Username,
            HotelCode: Challenge.HotelCode,
        });

        switch (LinkResult.Outcome) {
            case LinkOutcomes.Linked:
                this.Logger?.Info('Habbo account linked', { DiscordUserId, HotelCode: Challenge.HotelCode, LinkId: LinkResult.NewLink.LinkId, OperationId: LinkResult.OperationId });
                return { Outcome: VerificationOutcomes.Verified, Link: LinkResult.NewLink, PreviousLink: LinkResult.PreviousLink, OperationId: LinkResult.OperationId, Challenge };
            case LinkOutcomes.AlreadyLinkedElsewhere:
                await this.ChallengeRepository.TransitionStatus(ChallengeId, [ChallengeStatuses.Checking], ChallengeStatuses.Failed, this.Clock());
                return { Outcome: VerificationOutcomes.AlreadyLinkedElsewhere, Challenge };
            case LinkOutcomes.ChallengeExpired:
                await this.ChallengeRepository.TransitionStatus(ChallengeId, [ChallengeStatuses.Checking], ChallengeStatuses.Expired, this.Clock());
                return { Outcome: VerificationOutcomes.Expired, Challenge };
            default: {
                const Latest = await this.ChallengeRepository.FindChallengeById(ChallengeId);
                return this.ClosedOutcome(Latest ?? Challenge);
            }
        }
    }

    async CancelChallenge({ DiscordUserId, ChallengeId = null }) {
        const Now = this.Clock();
        if (ChallengeId) {
            const Challenge = await this.ChallengeRepository.FindChallengeById(ChallengeId);
            if (Challenge && Challenge.DiscordUserId === DiscordUserId) {
                await this.ChallengeRepository.TransitionStatus(ChallengeId, [ChallengeStatuses.Active, ChallengeStatuses.Checking], ChallengeStatuses.Cancelled, Now);
            }
        } else {
            await this.ChallengeRepository.CloseOpenChallengesForUser(DiscordUserId, ChallengeStatuses.Cancelled, Now);
        }
        return { Outcome: VerificationOutcomes.Cancelled };
    }

    async ExpireChallenge(ChallengeId) {
        return this.ChallengeRepository.TransitionStatus(ChallengeId, [ChallengeStatuses.Active], ChallengeStatuses.Expired, this.Clock());
    }

    async ExpireOverdueChallenges() {
        const ExpiredCount = await this.ChallengeRepository.ExpireOverdueChallenges(this.Clock());
        if (ExpiredCount > 0) {
            this.Logger?.Info('Expired overdue verification challenges', { ExpiredCount });
        }
        return ExpiredCount;
    }

    async GetVerificationStatus(DiscordUserId) {
        const Challenge = await this.ChallengeRepository.FindOpenChallengeForUser(DiscordUserId);
        if (!Challenge) {
            return { HasActiveChallenge: false, Challenge: null };
        }
        const IsExpired = Challenge.ExpiresTimestamp <= this.Clock();
        return {
            HasActiveChallenge: !IsExpired,
            Challenge: {
                ChallengeId: Challenge.ChallengeId,
                HotelCode: Challenge.HotelCode,
                HabboUsername: Challenge.HabboUsername,
                Status: IsExpired ? ChallengeStatuses.Expired : Challenge.Status,
                CreatedTimestamp: Challenge.CreatedTimestamp,
                ExpiresTimestamp: Challenge.ExpiresTimestamp,
                FailedAttemptCount: Challenge.FailedAttemptCount,
                RemainingAttempts: Math.max(0, this.Config.MaxAttempts - Challenge.FailedAttemptCount),
            },
        };
    }

    ClosedOutcome(Challenge) {
        if (Challenge.Status === ChallengeStatuses.Expired) {
            return { Outcome: VerificationOutcomes.Expired, Challenge };
        }
        if (Challenge.Status === ChallengeStatuses.Failed) {
            return { Outcome: VerificationOutcomes.Failed, Challenge };
        }
        return { Outcome: VerificationOutcomes.ChallengeClosed, Status: Challenge.Status, Challenge };
    }
}
