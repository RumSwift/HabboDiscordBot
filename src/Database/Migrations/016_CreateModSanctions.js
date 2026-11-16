// Moderation history recorded from /modpanel, per server (shown on the panel and used for escalating sanctions).
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS ModSanctions (
            SanctionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            GuildUuid CHAR(36) NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            SanctionType VARCHAR(32) NOT NULL,
            PrivateReason TEXT NULL,
            PublicReason TEXT NULL,
            Punishment VARCHAR(100) NULL,
            MessageLink VARCHAR(1000) NULL,
            SanctionLink VARCHAR(1000) NULL,
            ModeratorDiscordUserId VARCHAR(20) NOT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            PRIMARY KEY (SanctionId),
            KEY IX_ModSanctions_User (GuildUuid, DiscordUserId, CreatedTimestamp),
            CONSTRAINT FK_ModSanctions_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
