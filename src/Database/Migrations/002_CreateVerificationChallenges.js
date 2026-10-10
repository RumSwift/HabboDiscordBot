export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS VerificationChallenges (
            ChallengeId CHAR(36) NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            HabboUniqueId VARCHAR(64) NOT NULL,
            HabboUsername VARCHAR(64) NOT NULL,
            HotelCode VARCHAR(10) NOT NULL,
            -- HMAC of the code; the plaintext code is never stored.
            VerificationCodeHash CHAR(64) NOT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            ExpiresTimestamp DATETIME(3) NOT NULL,
            FailedAttemptCount INT UNSIGNED NOT NULL DEFAULT 0,
            Status VARCHAR(16) NOT NULL,
            StatusChangedTimestamp DATETIME(3) NOT NULL,
            ActiveDiscordUserId VARCHAR(20) AS (IF(Status IN ('ACTIVE', 'CHECKING'), DiscordUserId, NULL)) PERSISTENT,
            PRIMARY KEY (ChallengeId),
            UNIQUE KEY UQ_VerificationChallenges_ActiveDiscordUser (ActiveDiscordUserId),
            KEY IX_VerificationChallenges_StatusExpiry (Status, ExpiresTimestamp),
            KEY IX_VerificationChallenges_DiscordUserCreated (DiscordUserId, CreatedTimestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
