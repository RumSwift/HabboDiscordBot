const LinkColumns = `LinkId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode,
                     LinkedTimestamp, UnlinkedTimestamp, LinkSource, OperationId`;

export class HabboLinkRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async FindActiveLinkByDiscordUserId(DiscordUserId, Executor = this.Pool, { ForUpdate = false } = {}) {
        const [Rows] = await Executor.query(
            `SELECT ${LinkColumns} FROM HabboLinks
             WHERE ActiveDiscordUserId = ? ${ForUpdate ? 'FOR UPDATE' : ''}`,
            [DiscordUserId],
        );
        return Rows[0] ?? null;
    }

    async FindActiveLinkByHabboAccount(HotelCode, HabboUniqueId, Executor = this.Pool, { ForUpdate = false } = {}) {
        const [Rows] = await Executor.query(
            `SELECT ${LinkColumns} FROM HabboLinks
             WHERE HotelCode = ? AND ActiveHabboUniqueId = ? ${ForUpdate ? 'FOR UPDATE' : ''}`,
            [HotelCode, HabboUniqueId],
        );
        return Rows[0] ?? null;
    }

    async FindLinkById(LinkId, Executor = this.Pool) {
        const [Rows] = await Executor.query(`SELECT ${LinkColumns} FROM HabboLinks WHERE LinkId = ?`, [LinkId]);
        return Rows[0] ?? null;
    }

    async GetAllActiveLinks(Executor = this.Pool) {
        const [Rows] = await Executor.query(`SELECT ${LinkColumns} FROM HabboLinks WHERE ActiveDiscordUserId IS NOT NULL ORDER BY LinkId`);
        return Rows;
    }

    async HasActiveLink(DiscordUserId, Executor = this.Pool) {
        const [Rows] = await Executor.query('SELECT 1 FROM HabboLinks WHERE ActiveDiscordUserId = ? LIMIT 1', [DiscordUserId]);
        return Rows.length > 0;
    }

    async InsertLink({ DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, LinkedTimestamp, LinkSource, OperationId }, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `INSERT INTO HabboLinks
                (DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, LinkedTimestamp, LinkSource, OperationId)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, LinkedTimestamp, LinkSource, OperationId],
        );
        return String(Result.insertId);
    }

    async MarkLinkUnlinked(LinkId, DiscordUserId, UnlinkedTimestamp, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `UPDATE HabboLinks SET UnlinkedTimestamp = ?
             WHERE LinkId = ? AND DiscordUserId = ? AND UnlinkedTimestamp IS NULL`,
            [UnlinkedTimestamp, LinkId, DiscordUserId],
        );
        return Result.affectedRows === 1;
    }

    async GetLinkHistoryByDiscordUserId(DiscordUserId, { Limit = 100 } = {}, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT ${LinkColumns} FROM HabboLinks
             WHERE DiscordUserId = ?
             ORDER BY LinkedTimestamp DESC, LinkId DESC
             LIMIT ?`,
            [DiscordUserId, Limit],
        );
        return Rows;
    }

    async GetLinkHistoryByHabboAccount(HotelCode, HabboUniqueId, { Limit = 100 } = {}, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT ${LinkColumns} FROM HabboLinks
             WHERE HotelCode = ? AND HabboUniqueId = ?
             ORDER BY LinkedTimestamp DESC, LinkId DESC
             LIMIT ?`,
            [HotelCode, HabboUniqueId, Limit],
        );
        return Rows;
    }
}
