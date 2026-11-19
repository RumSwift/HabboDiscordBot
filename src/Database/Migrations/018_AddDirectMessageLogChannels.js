// Each server's log channel for DMs sent from the Modpanel. INSERT IGNORE keeps any row already set by hand.
export async function Up(Connection) {
    const Channels = [
        ['HABBO', '1558536141014302874'],
        ['ORIGINS', '1558536105677168742'],
    ];
    for (const [GuildType, ChannelId] of Channels) {
        await Connection.query("INSERT IGNORE INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) SELECT GuildUuid, 'DIRECT_MESSAGES', ? FROM Guilds WHERE GuildType = ?", [ChannelId, GuildType]);
    }
    // These channels were briefly added under the wrong type by an earlier version of this migration.
    await Connection.query("DELETE FROM GuildLogChannels WHERE ChannelType = 'VERBAL_WARNINGS'");
}
