// Members banned from contacting one server's mod team (mod mail and /dmmod). Bans are per server.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS ModMailBans (
            GuildUuid CHAR(36) NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            BannedByDiscordUserId VARCHAR(20) NOT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            PRIMARY KEY (GuildUuid, DiscordUserId),
            CONSTRAINT FK_ModMailBans_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    // Each server's general "Mod Actions" log thread. INSERT IGNORE keeps any row already set by hand.
    const Channels = [
        ['HABBO', '1558490822616416317'],
        ['ORIGINS', '1558536077134921849'],
    ];
    for (const [GuildType, ChannelId] of Channels) {
        await Connection.query("INSERT IGNORE INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) SELECT GuildUuid, 'MOD_ACTIONS', ? FROM Guilds WHERE GuildType = ?", [ChannelId, GuildType]);
    }
}
