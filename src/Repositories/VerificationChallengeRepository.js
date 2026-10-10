export const ChallengeStatuses = Object.freeze({
    Active: 'ACTIVE',
    Checking: 'CHECKING',
    Completed: 'COMPLETED',
    Failed: 'FAILED',
    Expired: 'EXPIRED',
    Cancelled: 'CANCELLED',
    Superseded: 'SUPERSEDED',
});

const ChallengeColumns = `ChallengeId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, VerificationCodeHash,
                          CreatedTimestamp, ExpiresTimestamp, FailedAttemptCount, Status, StatusChangedTimestamp`;

export class VerificationChallengeRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async InsertChallenge(Challenge, Executor = this.Pool) {
        await Executor.query(
            `INSERT INTO VerificationChallenges
                (ChallengeId, DiscordUserId, HabboUniqueId, HabboUsername, HotelCode, VerificationCodeHash,
                 CreatedTimestamp, ExpiresTimestamp, FailedAttemptCount, Status, StatusChangedTimestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?)`,
            [
                Challenge.ChallengeId,
                Challenge.DiscordUserId,
                Challenge.HabboUniqueId,
                Challenge.HabboUsername,
                Challenge.HotelCode,
                Challenge.VerificationCodeHash,
                Challenge.CreatedTimestamp,
                Challenge.ExpiresTimestamp,
                Challenge.CreatedTimestamp,
            ],
        );
    }

    async FindChallengeById(ChallengeId, Executor = this.Pool, { ForUpdate = false } = {}) {
        const [Rows] = await Executor.query(
            `SELECT ${ChallengeColumns} FROM VerificationChallenges WHERE ChallengeId = ? ${ForUpdate ? 'FOR UPDATE' : ''}`,
            [ChallengeId],
        );
        return Rows[0] ?? null;
    }

    async FindOpenChallengeForUser(DiscordUserId, Executor = this.Pool) {
        const [Rows] = await Executor.query(`SELECT ${ChallengeColumns} FROM VerificationChallenges WHERE ActiveDiscordUserId = ?`, [DiscordUserId]);
        return Rows[0] ?? null;
    }

    async CountChallengesCreatedSince(DiscordUserId, SinceTimestamp, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            'SELECT COUNT(*) AS ChallengeCount FROM VerificationChallenges WHERE DiscordUserId = ? AND CreatedTimestamp >= ?',
            [DiscordUserId, SinceTimestamp],
        );
        return Number(Rows[0].ChallengeCount);
    }

    async CloseOpenChallengesForUser(DiscordUserId, NewStatus, Now, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `UPDATE VerificationChallenges SET Status = ?, StatusChangedTimestamp = ?
             WHERE ActiveDiscordUserId = ?`,
            [NewStatus, Now, DiscordUserId],
        );
        return Result.affectedRows;
    }

    async TryBeginCheck(ChallengeId, DiscordUserId, Now, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `UPDATE VerificationChallenges SET Status = 'CHECKING', StatusChangedTimestamp = ?
             WHERE ChallengeId = ? AND DiscordUserId = ? AND Status = 'ACTIVE' AND ExpiresTimestamp > ?`,
            [Now, ChallengeId, DiscordUserId, Now],
        );
        return Result.affectedRows === 1;
    }

    async ReleaseCheck(ChallengeId, Now, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `UPDATE VerificationChallenges SET Status = 'ACTIVE', StatusChangedTimestamp = ?
             WHERE ChallengeId = ? AND Status = 'CHECKING'`,
            [Now, ChallengeId],
        );
        return Result.affectedRows === 1;
    }

    async RecordFailedAttempt(ChallengeId, MaxAttempts, Now, Executor = this.Pool) {
        // Status must be set first: MariaDB applies SET left to right.
        const [Result] = await Executor.query(
            `UPDATE VerificationChallenges
             SET Status = IF(FailedAttemptCount + 1 >= ?, 'FAILED', 'ACTIVE'),
                 FailedAttemptCount = FailedAttemptCount + 1,
                 StatusChangedTimestamp = ?
             WHERE ChallengeId = ? AND Status = 'CHECKING'`,
            [MaxAttempts, Now, ChallengeId],
        );
        if (Result.affectedRows !== 1) {
            return null;
        }
        return this.FindChallengeById(ChallengeId, Executor);
    }

    async TransitionStatus(ChallengeId, FromStatuses, NewStatus, Now, Executor = this.Pool) {
        const [Result] = await Executor.query(
            `UPDATE VerificationChallenges SET Status = ?, StatusChangedTimestamp = ?
             WHERE ChallengeId = ? AND Status IN (?)`,
            [NewStatus, Now, ChallengeId, FromStatuses],
        );
        return Result.affectedRows === 1;
    }

    async ExpireOverdueChallenges(Now, StaleCheckMs = 60000, Executor = this.Pool) {
        const StaleBefore = new Date(Now.getTime() - StaleCheckMs);

        const [ExpiredResult] = await Executor.query(
            `UPDATE VerificationChallenges SET Status = 'EXPIRED', StatusChangedTimestamp = ?
             WHERE (Status = 'ACTIVE' AND ExpiresTimestamp <= ?)
                OR (Status = 'CHECKING' AND ExpiresTimestamp <= ? AND StatusChangedTimestamp <= ?)`,
            [Now, Now, Now, StaleBefore],
        );

        await Executor.query(
            `UPDATE VerificationChallenges SET Status = 'ACTIVE', StatusChangedTimestamp = ?
             WHERE Status = 'CHECKING' AND ExpiresTimestamp > ? AND StatusChangedTimestamp <= ?`,
            [Now, Now, StaleBefore],
        );

        return ExpiredResult.affectedRows;
    }
}
