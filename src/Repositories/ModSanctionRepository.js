export const SanctionTypes = Object.freeze({
    EmergencyMute: 'EMERGENCY_MUTE',
    VerbalWarning: 'VERBAL_WARNING',
    GuidelinesStrike: 'GUIDELINES_STRIKE',
    InappropriateProfile: 'INAPPROPRIATE_PROFILE',
    Racism: 'RACISM',
    Scam: 'SCAM',
});

export class ModSanctionRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    // Returns the new SanctionId, or null when the server is not configured.
    async Add({ GuildId, DiscordUserId, SanctionType, PrivateReason = null, PublicReason = null, Punishment = null, MessageLink = null, SanctionLink = null, ModeratorDiscordUserId, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            `INSERT INTO ModSanctions (GuildUuid, DiscordUserId, SanctionType, PrivateReason, PublicReason, Punishment, MessageLink, SanctionLink, ModeratorDiscordUserId, CreatedTimestamp)
             SELECT GuildUuid, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM Guilds WHERE GuildId = ?`,
            [DiscordUserId, SanctionType, PrivateReason, PublicReason, Punishment, MessageLink, SanctionLink, ModeratorDiscordUserId, Now, GuildId],
        );
        return Result.affectedRows > 0 ? String(Result.insertId) : null;
    }

    // The member's history in this server, newest first.
    async GetForUser(GuildId, DiscordUserId) {
        const [Rows] = await this.Pool.query(
            `SELECT s.SanctionId, s.SanctionType, s.PrivateReason, s.PublicReason, s.Punishment, s.MessageLink, s.SanctionLink, s.ModeratorDiscordUserId, s.CreatedTimestamp
             FROM ModSanctions s JOIN Guilds g ON g.GuildUuid = s.GuildUuid
             WHERE g.GuildId = ? AND s.DiscordUserId = ?
             ORDER BY s.CreatedTimestamp DESC, s.SanctionId DESC`,
            [GuildId, DiscordUserId],
        );
        return Rows;
    }
}
