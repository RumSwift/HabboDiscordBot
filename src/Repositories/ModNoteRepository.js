export const NoteScopes = Object.freeze({
    Global: 'GLOBAL',
    Server: 'SERVER',
});

export class ModNoteRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Add({ DiscordUserId, OriginGuildId, Scope, Title, NoteText, MessageLink = null, AuthorDiscordUserId, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            `INSERT INTO ModNotes (DiscordUserId, OriginGuildUuid, Scope, Title, NoteText, MessageLink, AuthorDiscordUserId, CreatedTimestamp)
             SELECT ?, GuildUuid, ?, ?, ?, ?, ?, ? FROM Guilds WHERE GuildId = ?`,
            [DiscordUserId, Scope, Title, NoteText, MessageLink, AuthorDiscordUserId, Now, OriginGuildId],
        );
        return Result.affectedRows > 0 ? String(Result.insertId) : null;
    }

    async AddLogLink(NoteId, GuildId, LogLink) {
        await this.Pool.query(
            `INSERT INTO ModNoteLogMessages (NoteId, GuildUuid, LogLink)
             SELECT ?, GuildUuid, ? FROM Guilds WHERE GuildId = ?
             ON DUPLICATE KEY UPDATE LogLink = VALUES(LogLink)`,
            [NoteId, LogLink, GuildId],
        );
    }

    async GetVisibleNotes(GuildId, DiscordUserId) {
        const [Rows] = await this.Pool.query(
            `SELECT n.NoteId, n.Scope, n.Title, n.NoteText, n.MessageLink, n.AuthorDiscordUserId, n.CreatedTimestamp,
                    o.GuildId AS OriginGuildId, o.GuildType AS OriginGuildType, l.LogLink
             FROM ModNotes n
             JOIN Guilds o ON o.GuildUuid = n.OriginGuildUuid
             JOIN Guilds g ON g.GuildId = ?
             LEFT JOIN ModNoteLogMessages l ON l.NoteId = n.NoteId AND l.GuildUuid = g.GuildUuid
             WHERE n.DiscordUserId = ? AND (n.Scope = ? OR n.OriginGuildUuid = g.GuildUuid)
             ORDER BY n.CreatedTimestamp DESC, n.NoteId DESC`,
            [GuildId, DiscordUserId, NoteScopes.Global],
        );
        return Rows;
    }
}
