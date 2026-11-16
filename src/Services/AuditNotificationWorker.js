import { IntervalTask } from '../Utils/IntervalTask.js';
import { CalculateBackoffMs, DescribeError, IsPermanentFailure, MaxDeliveryAttempts } from '../Utils/RetryPolicy.js';

export class AuditNotificationWorker {
    constructor({ NotificationRepository, DiscordAuditLogService, Logger, Clock = () => new Date(), IntervalMs = 15000 }) {
        this.NotificationRepository = NotificationRepository;
        this.DiscordAuditLogService = DiscordAuditLogService;
        this.Logger = Logger;
        this.Clock = Clock;
        this.Task = new IntervalTask({ Name: 'AuditNotificationWorker', IntervalMs, Task: () => this.ProcessPendingNotifications(), Logger });
    }

    Start() {
        this.Task.Start();
    }

    async Stop() {
        await this.Task.Stop();
    }

    Wake() {
        this.Task.Trigger();
    }

    async ProcessPendingNotifications({ Limit = 10 } = {}) {
        const Summary = { Delivered: 0, Retrying: 0, Failed: 0 };
        const Notifications = await this.NotificationRepository.ClaimDueNotifications({ Now: this.Clock(), Limit });

        for (const Notification of Notifications) {
            try {
                const MessageId = await this.DiscordAuditLogService.SendAuditEvent(Notification);
                await this.NotificationRepository.MarkDelivered(Notification.NotificationId, Notification.LockToken, this.Clock(), MessageId);
                Summary.Delivered++;
            } catch (DeliveryError) {
                const IsPermanent = IsPermanentFailure(DeliveryError) || Notification.AttemptCount >= MaxDeliveryAttempts;
                await this.NotificationRepository.MarkDeliveryFailed(Notification.NotificationId, Notification.LockToken, {
                    IsPermanent,
                    NextAttemptTimestamp: new Date(this.Clock().getTime() + CalculateBackoffMs(Notification.AttemptCount)),
                    ErrorMessage: DescribeError(DeliveryError),
                });
                if (IsPermanent) {
                    Summary.Failed++;
                } else {
                    Summary.Retrying++;
                }
                this.Logger?.Warn(IsPermanent ? 'Audit notification failed permanently' : 'Audit notification delivery failed; will retry', {
                    NotificationId: Notification.NotificationId,
                    AuditLogId: Notification.AuditLogId,
                    ChannelId: Notification.ChannelId,
                    AttemptCount: Notification.AttemptCount,
                    Error: DeliveryError,
                });
            }
        }

        if (Summary.Delivered > 0) {
            this.Logger?.Debug('Audit notifications delivered', Summary);
        }
        return Summary;
    }
}
