export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS RoleOperations (
            RoleOperationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            OperationId CHAR(36) NOT NULL,
            LinkId BIGINT UNSIGNED NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            HotelCode VARCHAR(10) NOT NULL,
            RoleId VARCHAR(20) NOT NULL,
            OperationType VARCHAR(10) NOT NULL,
            Status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
            AttemptCount INT UNSIGNED NOT NULL DEFAULT 0,
            NextAttemptTimestamp DATETIME(3) NOT NULL,
            LockToken CHAR(36) NULL DEFAULT NULL,
            LockedUntilTimestamp DATETIME(3) NULL DEFAULT NULL,
            LastError VARCHAR(1000) NULL DEFAULT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            CompletedTimestamp DATETIME(3) NULL DEFAULT NULL,
            PRIMARY KEY (RoleOperationId),
            KEY IX_RoleOperations_Due (Status, NextAttemptTimestamp),
            KEY IX_RoleOperations_DiscordUser (DiscordUserId, Status),
            KEY IX_RoleOperations_LockToken (LockToken)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
