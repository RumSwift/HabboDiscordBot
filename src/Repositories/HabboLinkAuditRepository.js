export const AuditActionTypes = Object.freeze({ Linked: 'LINKED', Unlinked: 'UNLINKED' });

const AuditColumns = `a.AuditLogId, a.OperationId, a.LinkId, a.DiscordUserId, a.HabboUniqueId,
                      a.HabboUsername, a.HotelCode, a.ActionType, a.EventTimestamp, a.Details`;

export function MapAuditRow(Row) {
    if (!Row) {
        return null;
    }
    let Details = null;
    if (Row.Details) {
        try {
            Details = typeof Row.Details === 'string' ? JSON.parse(Row.Details) : Row.Details;
        } catch {
            Details = null;
        }
    }
    return { ...Row, Details };
}

export class HabboLinkAuditRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async InsertAuditEvent(
        { OperationId, LinkId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, ActionType, EventTimestamp, Details = null },
        Executor = this.Pool,
    ) {
        if (!Object.values(AuditActionTypes).includes(ActionType)) {
            throw new Error(`Invalid audit action type: ${ActionType}`);
        }
        const [Result] = await Executor.query(
            `INSERT INTO HabboLinkAuditLogs
                (OperationId, LinkId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, ActionType, EventTimestamp, Details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [OperationId, LinkId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, ActionType, EventTimestamp, Details ? JSON.stringify(Details) : null],
        );
        return String(Result.insertId);
    }

    async FindAuditEventById(AuditLogId, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT ${AuditColumns}, l.LinkedTimestamp AS OriginalLinkedTimestamp
             FROM HabboLinkAuditLogs a
             JOIN HabboLinks l ON l.LinkId = a.LinkId
             WHERE a.AuditLogId = ?`,
            [AuditLogId],
        );
        return MapAuditRow(Rows[0]);
    }

    async GetEventsByOperationId(OperationId, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT ${AuditColumns} FROM HabboLinkAuditLogs a WHERE a.OperationId = ? ORDER BY a.AuditLogId`,
            [OperationId],
        );
        return Rows.map(MapAuditRow);
    }

    async GetEventsForDiscordUser(DiscordUserId, { Limit = 100, Offset = 0 } = {}, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT ${AuditColumns} FROM HabboLinkAuditLogs a
             WHERE a.DiscordUserId = ?
             ORDER BY a.EventTimestamp DESC, a.AuditLogId DESC
             LIMIT ? OFFSET ?`,
            [DiscordUserId, Limit, Offset],
        );
        return Rows.map(MapAuditRow);
    }

    async GetEventSummaryForDiscordUser(DiscordUserId, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT
                 SUM(ActionType = 'LINKED') AS LinkedEventCount,
                 SUM(ActionType = 'UNLINKED') AS UnlinkedEventCount,
                 COUNT(*) AS TotalEventCount,
                 MAX(IF(ActionType = 'LINKED', EventTimestamp, NULL)) AS LastLinkedTimestamp,
                 MAX(IF(ActionType = 'UNLINKED', EventTimestamp, NULL)) AS LastUnlinkedTimestamp
             FROM HabboLinkAuditLogs
             WHERE DiscordUserId = ?`,
            [DiscordUserId],
        );
        const Row = Rows[0];
        return {
            LinkedEventCount: Number(Row.LinkedEventCount ?? 0),
            UnlinkedEventCount: Number(Row.UnlinkedEventCount ?? 0),
            TotalEventCount: Number(Row.TotalEventCount ?? 0),
            LastLinkedTimestamp: Row.LastLinkedTimestamp ?? null,
            LastUnlinkedTimestamp: Row.LastUnlinkedTimestamp ?? null,
        };
    }
}
