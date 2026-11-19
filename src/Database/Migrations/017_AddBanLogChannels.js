// Each server's "User Banned" log channel. INSERT IGNORE keeps any row already set by hand.
export async function Up(Connection) {
    const Channels = [
        ['HABBO', '1558490759961776158'],
        ['ORIGINS', '1558536043429634229'],
    ];
    for (const [GuildType, ChannelId] of Channels) {
        await Connection.query("INSERT IGNORE INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) SELECT GuildUuid, 'BAN_LOG', ? FROM Guilds WHERE GuildType = ?", [ChannelId, GuildType]);
    }
}
