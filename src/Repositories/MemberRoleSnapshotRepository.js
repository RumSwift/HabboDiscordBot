export class MemberRoleSnapshotRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Save(GuildId, DiscordUserId, RoleIds, Now = new Date()) {
        const [Result] = await this.Pool.query(
            `INSERT INTO MemberRoleSnapshots (GuildUuid, DiscordUserId, RoleIds, LeftTimestamp)
             SELECT GuildUuid, ?, ?, ? FROM Guilds WHERE GuildId = ?
             ON DUPLICATE KEY UPDATE RoleIds = VALUES(RoleIds), LeftTimestamp = VALUES(LeftTimestamp)`,
            [DiscordUserId, JSON.stringify(RoleIds), Now, GuildId],
        );
        return Result.affectedRows > 0;
    }

    async Find(GuildId, DiscordUserId) {
        const [Rows] = await this.Pool.query(
            `SELECT s.RoleIds, s.LeftTimestamp
             FROM MemberRoleSnapshots s
             JOIN Guilds g ON g.GuildUuid = s.GuildUuid
             WHERE g.GuildId = ? AND s.DiscordUserId = ?`,
            [GuildId, DiscordUserId],
        );
        if (!Rows[0]) {
            return null;
        }
        return { RoleIds: JSON.parse(Rows[0].RoleIds), LeftTimestamp: Rows[0].LeftTimestamp };
    }

    async Delete(GuildId, DiscordUserId) {
        await this.Pool.query(
            `DELETE s FROM MemberRoleSnapshots s
             JOIN Guilds g ON g.GuildUuid = s.GuildUuid
             WHERE g.GuildId = ? AND s.DiscordUserId = ?`,
            [GuildId, DiscordUserId],
        );
    }
}
