export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS AuditNotificationOutbox (
            NotificationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            AuditLogId BIGINT UNSIGNED NOT NULL,
            Status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
            AttemptCount INT UNSIGNED NOT NULL DEFAULT 0,
            NextAttemptTimestamp DATETIME(3) NOT NULL,
            LockToken CHAR(36) NULL DEFAULT NULL,
            LockedUntilTimestamp DATETIME(3) NULL DEFAULT NULL,
            LastError VARCHAR(1000) NULL DEFAULT NULL,
            DiscordMessageId VARCHAR(20) NULL DEFAULT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            DeliveredTimestamp DATETIME(3) NULL DEFAULT NULL,
            PRIMARY KEY (NotificationId),
            UNIQUE KEY UQ_AuditNotificationOutbox_AuditLog (AuditLogId),
            KEY IX_AuditNotificationOutbox_Due (Status, NextAttemptTimestamp),
            KEY IX_AuditNotificationOutbox_LockToken (LockToken),
            CONSTRAINT FK_AuditNotificationOutbox_AuditLog FOREIGN KEY (AuditLogId) REFERENCES HabboLinkAuditLogs (AuditLogId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
