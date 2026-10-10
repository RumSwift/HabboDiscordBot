export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS HabboLinkAuditLogs (
            AuditLogId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            OperationId CHAR(36) NOT NULL,
            LinkId BIGINT UNSIGNED NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            HabboUniqueId VARCHAR(64) NOT NULL,
            HabboUsername VARCHAR(64) NOT NULL,
            HotelCode VARCHAR(10) NOT NULL,
            ActionType VARCHAR(16) NOT NULL,
            EventTimestamp DATETIME(3) NOT NULL,
            Details LONGTEXT NULL DEFAULT NULL CHECK (Details IS NULL OR JSON_VALID(Details)),
            PRIMARY KEY (AuditLogId),
            KEY IX_HabboLinkAuditLogs_DiscordUser (DiscordUserId, EventTimestamp),
            KEY IX_HabboLinkAuditLogs_HabboAccount (HotelCode, HabboUniqueId, EventTimestamp),
            KEY IX_HabboLinkAuditLogs_OperationId (OperationId),
            CONSTRAINT FK_HabboLinkAuditLogs_Link FOREIGN KEY (LinkId) REFERENCES HabboLinks (LinkId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
