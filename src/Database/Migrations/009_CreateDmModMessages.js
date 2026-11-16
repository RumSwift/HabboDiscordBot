// Messages sent to the mod team with /dmmod, and where each server's /dmmod messages go.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS DmModMessages (
            DmModId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            GuildUuid CHAR(36) NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            MessageText TEXT NOT NULL,
            ReportedDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
            ReportedMessage VARCHAR(500) NULL DEFAULT NULL,
            ImageFileName VARCHAR(100) NULL DEFAULT NULL,
            ChannelId VARCHAR(20) NOT NULL,
            MessageId VARCHAR(20) NULL DEFAULT NULL,
            Status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
            RepliedByDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
            ReplyText TEXT NULL DEFAULT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            RepliedTimestamp DATETIME(3) NULL DEFAULT NULL,
            PRIMARY KEY (DmModId),
            KEY IX_DmModMessages_DiscordUser (DiscordUserId),
            CONSTRAINT FK_DmModMessages_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    // The /dmmod thread and mod-mail forum of each server. INSERT IGNORE keeps any row already set by hand.
    const Channels = [
        ['HABBO', 'DMMOD', '1567228706936852531'],
        ['HABBO', 'MODMAIL_FORUM', '1567228672040243372'],
        ['ORIGINS', 'DMMOD', '1567230048753295420'],
        ['ORIGINS', 'MODMAIL_FORUM', '1567229293552083044'],
    ];
    for (const [GuildType, ChannelType, ChannelId] of Channels) {
        await Connection.query('INSERT IGNORE INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) SELECT GuildUuid, ?, ? FROM Guilds WHERE GuildType = ?', [
            ChannelType,
            ChannelId,
            GuildType,
        ]);
    }
}
