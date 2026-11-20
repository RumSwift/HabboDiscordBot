export const BanOutcomes = Object.freeze({
    NotConfigured: 'NOT_CONFIGURED',
    Banned: 'BANNED',
    AlreadyBanned: 'ALREADY_BANNED',
    Extended: 'EXTENDED',
    Unbanned: 'UNBANNED',
    NotBanned: 'NOT_BANNED',
});

const ActiveBan = '(b.ExpiresTimestamp IS NULL OR b.ExpiresTimestamp > ?)';

export class ModMailBanRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Ban(GuildId, DiscordUserId, BannedByDiscordUserId, DurationMs, Now = new Date()) {
        await this.Pool.query(
            'DELETE b FROM ModMailBans b JOIN Guilds g ON g.GuildUuid = b.GuildUuid WHERE g.GuildId = ? AND b.DiscordUserId = ? AND b.ExpiresTimestamp <= ?',
            [GuildId, DiscordUserId, Now],
        );
        const ExpiresTimestamp = DurationMs === null ? null : new Date(Now.getTime() + DurationMs);
        try {
            const [Result] = await this.Pool.query(
                'INSERT INTO ModMailBans (GuildUuid, DiscordUserId, BannedByDiscordUserId, CreatedTimestamp, ExpiresTimestamp) SELECT GuildUuid, ?, ?, ?, ? FROM Guilds WHERE GuildId = ?',
                [DiscordUserId, BannedByDiscordUserId, Now, ExpiresTimestamp, GuildId],
            );
            return Result.affectedRows > 0 ? BanOutcomes.Banned : BanOutcomes.NotConfigured;
        } catch (InsertError) {
            if (InsertError.code === 'ER_DUP_ENTRY') {
                return BanOutcomes.AlreadyBanned;
            }
            throw InsertError;
        }
    }

    async Extend(GuildId, DiscordUserId, DurationMs, Now = new Date()) {
        const Ban = await this.GetActiveBan(GuildId, DiscordUserId, Now);
        if (!Ban) {
            return { Outcome: BanOutcomes.NotBanned };
        }
        if (Ban.ExpiresTimestamp === null) {
            return { Outcome: BanOutcomes.AlreadyBanned, ExpiresTimestamp: null };
        }
        const ExpiresTimestamp = DurationMs === null ? null : new Date(Ban.ExpiresTimestamp.getTime() + DurationMs);
        const [Result] = await this.Pool.query(
            'UPDATE ModMailBans b JOIN Guilds g ON g.GuildUuid = b.GuildUuid SET b.ExpiresTimestamp = ? WHERE g.GuildId = ? AND b.DiscordUserId = ? AND b.ExpiresTimestamp = ?',
            [ExpiresTimestamp, GuildId, DiscordUserId, Ban.ExpiresTimestamp],
        );
        return Result.affectedRows > 0 ? { Outcome: BanOutcomes.Extended, ExpiresTimestamp } : this.Extend(GuildId, DiscordUserId, DurationMs, Now);
    }

    async Unban(GuildId, DiscordUserId, Now = new Date()) {
        const [Result] = await this.Pool.query(
            `DELETE b FROM ModMailBans b JOIN Guilds g ON g.GuildUuid = b.GuildUuid WHERE g.GuildId = ? AND b.DiscordUserId = ? AND ${ActiveBan}`,
            [GuildId, DiscordUserId, Now],
        );
        return Result.affectedRows > 0 ? BanOutcomes.Unbanned : BanOutcomes.NotBanned;
    }

    async GetActiveBan(GuildId, DiscordUserId, Now = new Date()) {
        const [Rows] = await this.Pool.query(
            `SELECT b.BannedByDiscordUserId, b.CreatedTimestamp, b.ExpiresTimestamp
             FROM ModMailBans b JOIN Guilds g ON g.GuildUuid = b.GuildUuid
             WHERE g.GuildId = ? AND b.DiscordUserId = ? AND ${ActiveBan}`,
            [GuildId, DiscordUserId, Now],
        );
        return Rows[0] ?? null;
    }

    async IsBanned(GuildId, DiscordUserId, Now = new Date()) {
        return (await this.GetActiveBan(GuildId, DiscordUserId, Now)) !== null;
    }

    async GetBannedGuildIds(DiscordUserId, Now = new Date()) {
        const [Rows] = await this.Pool.query(`SELECT g.GuildId FROM ModMailBans b JOIN Guilds g ON g.GuildUuid = b.GuildUuid WHERE b.DiscordUserId = ? AND ${ActiveBan}`, [
            DiscordUserId,
            Now,
        ]);
        return new Set(Rows.map((Row) => Row.GuildId));
    }
}
