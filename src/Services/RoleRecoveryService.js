import { IntervalTask } from '../Utils/IntervalTask.js';
import { CalculateBackoffMs, DescribeError, IsPermanentFailure, MaxDeliveryAttempts } from '../Utils/RetryPolicy.js';
import { RoleOperationTypes } from '../Repositories/RoleOperationRepository.js';
import { GetHotel } from '../Utils/HotelConfiguration.js';

const UnknownMemberErrorCode = 10007;

export class RoleRecoveryService {
    constructor({ RoleOperationRepository, LinkRepository, DiscordRoleService, Logger, Clock = () => new Date(), IntervalMs = 30000 }) {
        this.RoleOperationRepository = RoleOperationRepository;
        this.LinkRepository = LinkRepository;
        this.DiscordRoleService = DiscordRoleService;
        this.Logger = Logger;
        this.Clock = Clock;
        this.Task = new IntervalTask({ Name: 'RoleRecovery', IntervalMs, Task: () => this.ProcessDueOperations(), Logger });
    }

    Start() {
        this.Task.Start();
    }

    async Stop() {
        await this.Task.Stop();
    }

    async ProcessDueOperations({ DiscordUserId = null, Limit = 20 } = {}) {
        const Operations = await this.RoleOperationRepository.ClaimDueOperations({ Now: this.Clock(), Limit, DiscordUserId });
        const Results = [];
        // Process in order: for one user, a REMOVE must run before the following ADD.
        for (const Operation of Operations) {
            Results.push(await this.ProcessOperation(Operation));
        }
        return Results;
    }

    async ProcessOperation(Operation) {
        const { RoleOperationId, LockToken, DiscordUserId, HotelCode, RoleId, GuildId, OperationType } = Operation;

        try {
            const ActiveLink = await this.LinkRepository.FindActiveLinkByDiscordUserId(DiscordUserId, GetHotel(HotelCode).Game);
            const ShouldHaveRole = ActiveLink?.HotelCode === HotelCode;

            if (OperationType === RoleOperationTypes.Add && !ShouldHaveRole) {
                await this.RoleOperationRepository.MarkFinished(RoleOperationId, LockToken, 'SKIPPED', this.Clock(), 'User no longer has an active link for this hotel.');
                return 'SKIPPED';
            }
            if (OperationType === RoleOperationTypes.Remove && ShouldHaveRole) {
                await this.RoleOperationRepository.MarkFinished(RoleOperationId, LockToken, 'SKIPPED', this.Clock(), 'User has an active link for this hotel again.');
                return 'SKIPPED';
            }

            const Reason = `Habbo verification (${OperationType} ${HotelCode})`;
            if (OperationType === RoleOperationTypes.Add) {
                await this.DiscordRoleService.AddRole(DiscordUserId, RoleId, Reason, GuildId);
            } else {
                await this.DiscordRoleService.RemoveRole(DiscordUserId, RoleId, Reason, GuildId);
            }

            await this.RoleOperationRepository.MarkFinished(RoleOperationId, LockToken, 'COMPLETED', this.Clock());
            this.Logger?.Info('Discord role updated', { DiscordUserId, HotelCode, GuildId, OperationType });
            return 'COMPLETED';
        } catch (RoleError) {
            // Not in that server (yet). They get the role when they join.
            if (RoleError?.code === UnknownMemberErrorCode) {
                await this.RoleOperationRepository.MarkFinished(RoleOperationId, LockToken, 'SKIPPED', this.Clock(), 'Member is not in the server.');
                this.Logger?.Debug('Role change skipped: member is not in the server', { DiscordUserId, GuildId, OperationType });
                return 'SKIPPED';
            }
            const IsPermanent = IsPermanentFailure(RoleError) || Operation.AttemptCount >= MaxDeliveryAttempts;
            const NextAttemptTimestamp = new Date(this.Clock().getTime() + CalculateBackoffMs(Operation.AttemptCount));
            await this.RoleOperationRepository.MarkAttemptFailed(RoleOperationId, LockToken, {
                IsPermanent,
                NextAttemptTimestamp,
                ErrorMessage: DescribeError(RoleError),
            });
            this.Logger?.Warn(IsPermanent ? 'Discord role change failed permanently' : 'Discord role change failed; will retry', {
                DiscordUserId,
                HotelCode,
                OperationType,
                AttemptCount: Operation.AttemptCount,
                Error: RoleError,
            });
            return IsPermanent ? 'FAILED' : 'RETRY';
        }
    }
}
