// Channels (or categories) that a server's logs ignore. Everything else is logged.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS GuildLogExclusions (
            GuildLogExclusionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            GuildUuid CHAR(36) NOT NULL,
            ChannelId VARCHAR(20) NOT NULL,
            AddedByDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            PRIMARY KEY (GuildLogExclusionId),
            UNIQUE KEY UQ_GuildLogExclusions_GuildChannel (GuildUuid, ChannelId),
            CONSTRAINT FK_GuildLogExclusions_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
