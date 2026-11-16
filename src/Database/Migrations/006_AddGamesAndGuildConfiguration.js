// Every statement is safe to re-run, because MariaDB commits DDL immediately and a
// half-applied migration must be able to finish on the next start.
export async function Up(Connection) {
    await Connection.query('ALTER TABLE HabboLinks MODIFY HotelCode VARCHAR(16) NOT NULL');
    await Connection.query("ALTER TABLE HabboLinks ADD COLUMN IF NOT EXISTS Game VARCHAR(16) NOT NULL DEFAULT 'HABBO' AFTER HotelCode");
    // One active link per game (one Habbo + one Origins), instead of one in total.
    await Connection.query('ALTER TABLE HabboLinks ADD UNIQUE KEY IF NOT EXISTS UQ_HabboLinks_ActiveDiscordUserGame (ActiveDiscordUserId, Game)');
    await Connection.query('ALTER TABLE HabboLinks DROP INDEX IF EXISTS UQ_HabboLinks_ActiveDiscordUser');

    await Connection.query('ALTER TABLE VerificationChallenges MODIFY HotelCode VARCHAR(16) NOT NULL');
    await Connection.query('ALTER TABLE HabboLinkAuditLogs MODIFY HotelCode VARCHAR(16) NOT NULL');

    await Connection.query('ALTER TABLE RoleOperations MODIFY HotelCode VARCHAR(16) NOT NULL');
    await Connection.query('ALTER TABLE RoleOperations ADD COLUMN IF NOT EXISTS GuildId VARCHAR(20) NULL DEFAULT NULL AFTER RoleId');

    // Each audit event is now delivered once per logging channel.
    await Connection.query('ALTER TABLE AuditNotificationOutbox ADD COLUMN IF NOT EXISTS ChannelId VARCHAR(20) NULL DEFAULT NULL AFTER AuditLogId');
    await Connection.query('ALTER TABLE AuditNotificationOutbox ADD UNIQUE KEY IF NOT EXISTS UQ_AuditNotificationOutbox_AuditLogChannel (AuditLogId, ChannelId)');
    await Connection.query('ALTER TABLE AuditNotificationOutbox DROP INDEX IF EXISTS UQ_AuditNotificationOutbox_AuditLog');

    await Connection.query(`
        CREATE TABLE IF NOT EXISTS Guilds (
            GuildUuid CHAR(36) NOT NULL,
            GuildType VARCHAR(16) NOT NULL,
            Name VARCHAR(100) NOT NULL,
            GuildId VARCHAR(20) NOT NULL,
            CreatedTimestamp DATETIME(3) NOT NULL,
            PRIMARY KEY (GuildUuid),
            UNIQUE KEY UQ_Guilds_GuildId (GuildId),
            KEY IX_Guilds_GuildType (GuildType)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    await Connection.query(`
        CREATE TABLE IF NOT EXISTS GuildRoles (
            GuildRoleId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            GuildUuid CHAR(36) NOT NULL,
            RoleType VARCHAR(32) NOT NULL,
            RoleId VARCHAR(20) NOT NULL,
            PRIMARY KEY (GuildRoleId),
            UNIQUE KEY UQ_GuildRoles_GuildRoleType (GuildUuid, RoleType),
            CONSTRAINT FK_GuildRoles_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    await Connection.query(`
        CREATE TABLE IF NOT EXISTS GuildLogChannels (
            GuildLogChannelId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            GuildUuid CHAR(36) NOT NULL,
            ChannelType VARCHAR(32) NOT NULL,
            ChannelId VARCHAR(20) NOT NULL,
            PRIMARY KEY (GuildLogChannelId),
            UNIQUE KEY UQ_GuildLogChannels_GuildChannelType (GuildUuid, ChannelType),
            CONSTRAINT FK_GuildLogChannels_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
