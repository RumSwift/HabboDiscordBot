export const SanctionTypes = Object.freeze({
    EmergencyMute: 'EMERGENCY_MUTE',
    VerbalWarning: 'VERBAL_WARNING',
    GuidelinesStrike: 'GUIDELINES_STRIKE',
    InappropriateProfile: 'INAPPROPRIATE_PROFILE',
    Racism: 'RACISM',
    Scam: 'SCAM',
    Custom: 'CUSTOM',
});

export class ModSanctionRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Add({ GuildId, DiscordUserId, SanctionType, PrivateReason = null, PublicReason = null, Punishment = null, MessageLink = null, SanctionLink = null, ModeratorDiscordUserId, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            `INSERT INTO ModSanctions (GuildUuid, DiscordUserId, SanctionType, PrivateReason, PublicReason, Punishment, MessageLink, SanctionLink, ModeratorDiscordUserId, CreatedTimestamp)
             SELECT GuildUuid, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM Guilds WHERE GuildId = ?`,
            [DiscordUserId, SanctionType, PrivateReason, PublicReason, Punishment, MessageLink, SanctionLink, ModeratorDiscordUserId, Now, GuildId],
        );
        return Result.affectedRows > 0 ? String(Result.insertId) : null;
    }

    async GetForUser(GuildId, DiscordUserId) {
        const [Rows] = await this.Pool.query(
            `SELECT s.SanctionId, s.SanctionType, s.PrivateReason, s.PublicReason, s.Punishment, s.MessageLink, s.SanctionLink, s.ModeratorDiscordUserId, s.CreatedTimestamp
             FROM ModSanctions s JOIN Guilds g ON g.GuildUuid = s.GuildUuid
             WHERE g.GuildId = ? AND s.DiscordUserId = ? AND s.ForgivenTimestamp IS NULL
             ORDER BY s.CreatedTimestamp DESC, s.SanctionId DESC`,
            [GuildId, DiscordUserId],
        );
        return Rows;
    }

    async Forgive({ GuildId, SanctionId, ModeratorDiscordUserId, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            `UPDATE ModSanctions s JOIN Guilds g ON g.GuildUuid = s.GuildUuid
             SET s.ForgivenTimestamp = ?, s.ForgivenByDiscordUserId = ?
             WHERE s.SanctionId = ? AND g.GuildId = ? AND s.ForgivenTimestamp IS NULL`,
            [Now, ModeratorDiscordUserId, SanctionId, GuildId],
        );
        return Result.affectedRows > 0;
    }
}
