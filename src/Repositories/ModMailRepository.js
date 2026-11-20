export const ModMailStatuses = Object.freeze({ Open: 'OPEN', Closed: 'CLOSED', Passed: 'PASSED' });

const ModMailColumns = `m.ModMailId, g.GuildId, g.GuildType, m.DiscordUserId, m.Title, m.Inquiry, m.ForumChannelId, m.ThreadId, m.Status,
                        m.PassedFromModMailId, m.FirstModReplyTimestamp, m.ClosedByDiscordUserId, m.CreatedTimestamp, m.LastActivityTimestamp, m.ClosedTimestamp`;

function ToModMail(Row) {
    return Row ? { ...Row, ModMailId: String(Row.ModMailId), PassedFromModMailId: Row.PassedFromModMailId ? String(Row.PassedFromModMailId) : null } : null;
}

export class ModMailRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Create({ GuildId, DiscordUserId, Title, Inquiry, ForumChannelId, PassedFromModMailId = null, Now = new Date() }) {
        try {
            const [Result] = await this.Pool.query(
                `INSERT INTO ModMails (GuildUuid, DiscordUserId, OpenDiscordUserId, Title, Inquiry, ForumChannelId, Status, PassedFromModMailId, CreatedTimestamp, LastActivityTimestamp)
                 SELECT GuildUuid, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ? FROM Guilds WHERE GuildId = ?`,
                [DiscordUserId, DiscordUserId, Title, Inquiry, ForumChannelId, PassedFromModMailId, Now, Now, GuildId],
            );
            if (Result.affectedRows === 0) {
                throw new Error(`Server ${GuildId} is not in the Guilds table.`);
            }
            return String(Result.insertId);
        } catch (InsertError) {
            if (InsertError.code === 'ER_DUP_ENTRY') {
                return null;
            }
            throw InsertError;
        }
    }

    async SetThreadId(ModMailId, ThreadId) {
        await this.Pool.query('UPDATE ModMails SET ThreadId = ? WHERE ModMailId = ?', [ThreadId, ModMailId]);
    }

    async Delete(ModMailId) {
        await this.Pool.query('DELETE FROM ModMails WHERE ModMailId = ?', [ModMailId]);
    }

    async FindById(ModMailId) {
        const [Rows] = await this.Pool.query(`SELECT ${ModMailColumns} FROM ModMails m JOIN Guilds g ON g.GuildUuid = m.GuildUuid WHERE m.ModMailId = ?`, [ModMailId]);
        return ToModMail(Rows[0]);
    }

    async FindOpenByUser(DiscordUserId) {
        const [Rows] = await this.Pool.query(`SELECT ${ModMailColumns} FROM ModMails m JOIN Guilds g ON g.GuildUuid = m.GuildUuid WHERE m.OpenDiscordUserId = ?`, [DiscordUserId]);
        return ToModMail(Rows[0]);
    }

    async FindOpenByThreadId(ThreadId) {
        const [Rows] = await this.Pool.query(`SELECT ${ModMailColumns} FROM ModMails m JOIN Guilds g ON g.GuildUuid = m.GuildUuid WHERE m.ThreadId = ? AND m.Status = 'OPEN'`, [ThreadId]);
        return ToModMail(Rows[0]);
    }

    async Close(ModMailId, ClosedByDiscordUserId, Now = new Date()) {
        const [Result] = await this.Pool.query(
            "UPDATE ModMails SET Status = 'CLOSED', OpenDiscordUserId = NULL, ClosedByDiscordUserId = ?, ClosedTimestamp = ? WHERE ModMailId = ? AND Status = 'OPEN'",
            [ClosedByDiscordUserId, Now, ModMailId],
        );
        return Result.affectedRows > 0;
    }

    async MarkPassed(ModMailId, PassedByDiscordUserId, Now = new Date()) {
        const [Result] = await this.Pool.query(
            "UPDATE ModMails SET Status = 'PASSED', OpenDiscordUserId = NULL, ClosedByDiscordUserId = ?, ClosedTimestamp = ? WHERE ModMailId = ? AND Status = 'OPEN' AND FirstModReplyTimestamp IS NULL",
            [PassedByDiscordUserId, Now, ModMailId],
        );
        return Result.affectedRows > 0;
    }

    async UndoPass(ModMailId) {
        await this.Pool.query(
            "UPDATE ModMails SET Status = 'OPEN', OpenDiscordUserId = DiscordUserId, ClosedByDiscordUserId = NULL, ClosedTimestamp = NULL WHERE ModMailId = ? AND Status = 'PASSED'",
            [ModMailId],
        );
    }

    async MarkModReplied(ModMailId, Now = new Date()) {
        const [Result] = await this.Pool.query('UPDATE ModMails SET FirstModReplyTimestamp = ? WHERE ModMailId = ? AND FirstModReplyTimestamp IS NULL', [Now, ModMailId]);
        return Result.affectedRows > 0;
    }

    async TouchActivity(ModMailId, Now = new Date()) {
        await this.Pool.query('UPDATE ModMails SET LastActivityTimestamp = ? WHERE ModMailId = ?', [Now, ModMailId]);
    }
}
