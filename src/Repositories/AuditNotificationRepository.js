import { randomUUID } from 'node:crypto';
import { MapAuditRow } from './HabboLinkAuditRepository.js';

export const NotificationStatuses = Object.freeze({
    Pending: 'PENDING',
    Processing: 'PROCESSING',
    Delivered: 'DELIVERED',
    Failed: 'FAILED',
});

export class AuditNotificationRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async InsertPendingNotification(AuditLogId, ChannelId, Now, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `INSERT INTO AuditNotificationOutbox (AuditLogId, ChannelId, Status, AttemptCount, NextAttemptTimestamp, CreatedTimestamp)
             VALUES (?, ?, 'PENDING', 0, ?, ?)`,
            [AuditLogId, ChannelId, Now, Now],
        );
        return String(Result.insertId);
    }

    async ClaimDueNotifications({ Now, Limit = 10, LockDurationMs = 60000 }) {
        // A single atomic UPDATE claims the rows, so two workers never get the same one.
        const LockToken = randomUUID();
        const LockedUntil = new Date(Now.getTime() + LockDurationMs);

        const [ClaimResult] = await this.Pool.query(
            `UPDATE AuditNotificationOutbox
             SET Status = 'PROCESSING', LockToken = ?, LockedUntilTimestamp = ?, AttemptCount = AttemptCount + 1
             WHERE (Status = 'PENDING' AND NextAttemptTimestamp <= ?)
                OR (Status = 'PROCESSING' AND LockedUntilTimestamp <= ?)
             ORDER BY NotificationId
             LIMIT ?`,
            [LockToken, LockedUntil, Now, Now, Limit],
        );
        if (ClaimResult.affectedRows === 0) {
            return [];
        }

        const [Rows] = await this.Pool.query(
            `SELECT n.NotificationId, n.ChannelId, n.AttemptCount, n.LockToken,
                    a.AuditLogId, a.OperationId, a.LinkId, a.DiscordUserId, a.HabboUniqueId, a.HabboUsername,
                    a.HotelCode, a.ActionType, a.EventTimestamp, a.Details,
                    l.Game, l.LinkedTimestamp AS OriginalLinkedTimestamp
             FROM AuditNotificationOutbox n
             JOIN HabboLinkAuditLogs a ON a.AuditLogId = n.AuditLogId
             JOIN HabboLinks l ON l.LinkId = a.LinkId
             WHERE n.LockToken = ?
             ORDER BY n.NotificationId`,
            [LockToken],
        );
        return Rows.map(MapAuditRow);
    }

    async MarkDelivered(NotificationId, LockToken, Now, DiscordMessageId) {
        const [Result] = await this.Pool.query(
            `UPDATE AuditNotificationOutbox
             SET Status = 'DELIVERED', DeliveredTimestamp = ?, DiscordMessageId = ?, LastError = NULL,
                 LockToken = NULL, LockedUntilTimestamp = NULL
             WHERE NotificationId = ? AND LockToken = ?`,
            [Now, DiscordMessageId ?? null, NotificationId, LockToken],
        );
        return Result.affectedRows === 1;
    }

    async MarkDeliveryFailed(NotificationId, LockToken, { IsPermanent, NextAttemptTimestamp, ErrorMessage }) {
        const [Result] = await this.Pool.query(
            `UPDATE AuditNotificationOutbox
             SET Status = ?, NextAttemptTimestamp = ?, LastError = ?, LockToken = NULL, LockedUntilTimestamp = NULL
             WHERE NotificationId = ? AND LockToken = ?`,
            [IsPermanent ? 'FAILED' : 'PENDING', NextAttemptTimestamp, String(ErrorMessage).slice(0, 1000), NotificationId, LockToken],
        );
        return Result.affectedRows === 1;
    }

    async CountPendingNotifications() {
        const [Rows] = await this.Pool.query(
            "SELECT COUNT(*) AS PendingCount FROM AuditNotificationOutbox WHERE Status IN ('PENDING', 'PROCESSING')",
        );
        return Number(Rows[0].PendingCount);
    }

    async GetDeliveryStatusSummary() {
        const [Rows] = await this.Pool.query('SELECT Status, COUNT(*) AS NotificationCount FROM AuditNotificationOutbox GROUP BY Status');
        const Summary = { PENDING: 0, PROCESSING: 0, DELIVERED: 0, FAILED: 0 };
        for (const Row of Rows) {
            Summary[Row.Status] = Number(Row.NotificationCount);
        }
        return Summary;
    }

    async FindNotificationsByAuditLogId(AuditLogId) {
        const [Rows] = await this.Pool.query(
            `SELECT NotificationId, AuditLogId, ChannelId, Status, AttemptCount, NextAttemptTimestamp, LastError,
                    DiscordMessageId, CreatedTimestamp, DeliveredTimestamp
             FROM AuditNotificationOutbox WHERE AuditLogId = ? ORDER BY NotificationId`,
            [AuditLogId],
        );
        return Rows;
    }
}
