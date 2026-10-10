import { randomUUID } from 'node:crypto';

export const RoleOperationTypes = Object.freeze({ Add: 'ADD', Remove: 'REMOVE' });

const RoleOperationColumns = `RoleOperationId, OperationId, LinkId, DiscordUserId, HotelCode, RoleId, OperationType,
                              Status, AttemptCount, NextAttemptTimestamp, LockToken, LastError, CreatedTimestamp, CompletedTimestamp`;

export class RoleOperationRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async InsertRoleOperation({ OperationId, LinkId, DiscordUserId, HotelCode, RoleId, OperationType, Now }, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `INSERT INTO RoleOperations
                (OperationId, LinkId, DiscordUserId, HotelCode, RoleId, OperationType, Status, AttemptCount, NextAttemptTimestamp, CreatedTimestamp)
             VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
            [OperationId, LinkId, DiscordUserId, HotelCode, RoleId, OperationType, Now, Now],
        );
        return String(Result.insertId);
    }

    async ClaimDueOperations({ Now, Limit = 10, LockDurationMs = 60000, DiscordUserId = null }) {
        const LockToken = randomUUID();
        const LockedUntil = new Date(Now.getTime() + LockDurationMs);

        const [ClaimResult] = await this.Pool.query(
            `UPDATE RoleOperations
             SET Status = 'PROCESSING', LockToken = ?, LockedUntilTimestamp = ?, AttemptCount = AttemptCount + 1
             WHERE ((Status = 'PENDING' AND NextAttemptTimestamp <= ?)
                 OR (Status = 'PROCESSING' AND LockedUntilTimestamp <= ?))
               AND (? IS NULL OR DiscordUserId = ?)
             ORDER BY RoleOperationId
             LIMIT ?`,
            [LockToken, LockedUntil, Now, Now, DiscordUserId, DiscordUserId, Limit],
        );
        if (ClaimResult.affectedRows === 0) {
            return [];
        }

        const [Rows] = await this.Pool.query(
            `SELECT ${RoleOperationColumns} FROM RoleOperations WHERE LockToken = ? ORDER BY RoleOperationId`,
            [LockToken],
        );
        return Rows;
    }

    async MarkFinished(RoleOperationId, LockToken, Status, Now, Note = null) {
        const [Result] = await this.Pool.query(
            `UPDATE RoleOperations
             SET Status = ?, CompletedTimestamp = ?, LastError = ?, LockToken = NULL, LockedUntilTimestamp = NULL
             WHERE RoleOperationId = ? AND LockToken = ?`,
            [Status, Now, Note, RoleOperationId, LockToken],
        );
        return Result.affectedRows === 1;
    }

    async MarkAttemptFailed(RoleOperationId, LockToken, { IsPermanent, NextAttemptTimestamp, ErrorMessage }) {
        const [Result] = await this.Pool.query(
            `UPDATE RoleOperations
             SET Status = ?, NextAttemptTimestamp = ?, LastError = ?, LockToken = NULL, LockedUntilTimestamp = NULL
             WHERE RoleOperationId = ? AND LockToken = ?`,
            [IsPermanent ? 'FAILED' : 'PENDING', NextAttemptTimestamp, String(ErrorMessage).slice(0, 1000), RoleOperationId, LockToken],
        );
        return Result.affectedRows === 1;
    }

    async GetOperationsForUser(DiscordUserId) {
        const [Rows] = await this.Pool.query(
            `SELECT ${RoleOperationColumns} FROM RoleOperations WHERE DiscordUserId = ? ORDER BY RoleOperationId`,
            [DiscordUserId],
        );
        return Rows;
    }
}
