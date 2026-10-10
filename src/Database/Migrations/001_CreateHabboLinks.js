export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS HabboLinks (
            LinkId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            DiscordUserId VARCHAR(20) NOT NULL,
            HabboUniqueId VARCHAR(64) NOT NULL,
            HabboUsername VARCHAR(64) NOT NULL,
            HotelCode VARCHAR(10) NOT NULL,
            LinkedTimestamp DATETIME(3) NOT NULL,
            UnlinkedTimestamp DATETIME(3) NULL DEFAULT NULL,
            LinkSource VARCHAR(32) NOT NULL DEFAULT 'VERIFICATION',
            OperationId CHAR(36) NOT NULL,
            ActiveDiscordUserId VARCHAR(20) AS (IF(UnlinkedTimestamp IS NULL, DiscordUserId, NULL)) PERSISTENT,
            ActiveHabboUniqueId VARCHAR(64) AS (IF(UnlinkedTimestamp IS NULL, HabboUniqueId, NULL)) PERSISTENT,
            PRIMARY KEY (LinkId),
            -- Active* columns are NULL once unlinked, so only active links must be unique.
            UNIQUE KEY UQ_HabboLinks_ActiveDiscordUser (ActiveDiscordUserId),
            UNIQUE KEY UQ_HabboLinks_ActiveHabboAccount (HotelCode, ActiveHabboUniqueId),
            KEY IX_HabboLinks_DiscordUserHistory (DiscordUserId, LinkedTimestamp),
            KEY IX_HabboLinks_HabboAccountHistory (HotelCode, HabboUniqueId, LinkedTimestamp),
            KEY IX_HabboLinks_OperationId (OperationId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
