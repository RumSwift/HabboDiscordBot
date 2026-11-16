// The moderator role pinged on /dmmod messages in each server. INSERT IGNORE keeps any row already set by hand.
export async function Up(Connection) {
    const Roles = [
        ['HABBO', '1558489381646508092'],
        ['ORIGINS', '1558536207871508510'],
    ];
    for (const [GuildType, RoleId] of Roles) {
        await Connection.query("INSERT IGNORE INTO GuildRoles (GuildUuid, RoleType, RoleId) SELECT GuildUuid, 'COM_MOD', ? FROM Guilds WHERE GuildType = ?", [RoleId, GuildType]);
    }
}
