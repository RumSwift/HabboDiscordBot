import mysql from 'mysql2/promise';

const TableOptions = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
const SchemaLockName = 'HabboVerifyBot_Schema';

export const Tables = [
    [
        'HabboLinks',
        `LinkId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        DiscordUserId VARCHAR(20) NOT NULL,
        HabboUniqueId VARCHAR(64) NOT NULL,
        HabboUsername VARCHAR(64) NOT NULL,
        HotelCode VARCHAR(16) NOT NULL,
        Game VARCHAR(16) NOT NULL DEFAULT 'HABBO',
        LinkedTimestamp DATETIME(3) NOT NULL,
        UnlinkedTimestamp DATETIME(3) NULL DEFAULT NULL,
        LinkSource VARCHAR(32) NOT NULL DEFAULT 'VERIFICATION',
        OperationId CHAR(36) NOT NULL,
        ActiveDiscordUserId VARCHAR(20) AS (IF(UnlinkedTimestamp IS NULL, DiscordUserId, NULL)) PERSISTENT,
        ActiveHabboUniqueId VARCHAR(64) AS (IF(UnlinkedTimestamp IS NULL, HabboUniqueId, NULL)) PERSISTENT,
        PRIMARY KEY (LinkId),
        UNIQUE KEY UQ_HabboLinks_ActiveHabboAccount (HotelCode, ActiveHabboUniqueId),
        KEY IX_HabboLinks_DiscordUserHistory (DiscordUserId, LinkedTimestamp),
        KEY IX_HabboLinks_HabboAccountHistory (HotelCode, HabboUniqueId, LinkedTimestamp),
        KEY IX_HabboLinks_OperationId (OperationId),
        UNIQUE KEY UQ_HabboLinks_ActiveDiscordUserGame (ActiveDiscordUserId, Game)`,
    ],
    [
        'VerificationChallenges',
        `ChallengeId CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        HabboUniqueId VARCHAR(64) NOT NULL,
        HabboUsername VARCHAR(64) NOT NULL,
        HotelCode VARCHAR(16) NOT NULL,
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
        KEY IX_VerificationChallenges_DiscordUserCreated (DiscordUserId, CreatedTimestamp)`,
    ],
    [
        'RoleOperations',
        `RoleOperationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        OperationId CHAR(36) NOT NULL,
        LinkId BIGINT UNSIGNED NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        HotelCode VARCHAR(16) NOT NULL,
        RoleId VARCHAR(20) NOT NULL,
        GuildId VARCHAR(20) NULL DEFAULT NULL,
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
        KEY IX_RoleOperations_LockToken (LockToken)`,
    ],
    [
        'HabboLinkAuditLogs',
        `AuditLogId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        OperationId CHAR(36) NOT NULL,
        LinkId BIGINT UNSIGNED NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        HabboUniqueId VARCHAR(64) NOT NULL,
        HabboUsername VARCHAR(64) NOT NULL,
        HotelCode VARCHAR(16) NOT NULL,
        ActionType VARCHAR(16) NOT NULL,
        EventTimestamp DATETIME(3) NOT NULL,
        Details LONGTEXT NULL DEFAULT NULL CHECK (Details IS NULL OR JSON_VALID(Details)),
        PRIMARY KEY (AuditLogId),
        KEY IX_HabboLinkAuditLogs_DiscordUser (DiscordUserId, EventTimestamp),
        KEY IX_HabboLinkAuditLogs_HabboAccount (HotelCode, HabboUniqueId, EventTimestamp),
        KEY IX_HabboLinkAuditLogs_OperationId (OperationId),
        CONSTRAINT FK_HabboLinkAuditLogs_Link FOREIGN KEY (LinkId) REFERENCES HabboLinks (LinkId)`,
    ],
    [
        'AuditNotificationOutbox',
        `NotificationId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        AuditLogId BIGINT UNSIGNED NOT NULL,
        ChannelId VARCHAR(20) NULL DEFAULT NULL,
        Status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
        AttemptCount INT UNSIGNED NOT NULL DEFAULT 0,
        NextAttemptTimestamp DATETIME(3) NOT NULL,
        LockToken CHAR(36) NULL DEFAULT NULL,
        LockedUntilTimestamp DATETIME(3) NULL DEFAULT NULL,
        LastError VARCHAR(1000) NULL DEFAULT NULL,
        DiscordMessageId VARCHAR(20) NULL DEFAULT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        DeliveredTimestamp DATETIME(3) NULL DEFAULT NULL,
        PRIMARY KEY (NotificationId),
        KEY IX_AuditNotificationOutbox_Due (Status, NextAttemptTimestamp),
        KEY IX_AuditNotificationOutbox_LockToken (LockToken),
        UNIQUE KEY UQ_AuditNotificationOutbox_AuditLogChannel (AuditLogId, ChannelId),
        CONSTRAINT FK_AuditNotificationOutbox_AuditLog FOREIGN KEY (AuditLogId) REFERENCES HabboLinkAuditLogs (AuditLogId)`,
    ],
    [
        'Guilds',
        `GuildUuid CHAR(36) NOT NULL,
        GuildType VARCHAR(16) NOT NULL,
        Name VARCHAR(100) NOT NULL,
        GuildId VARCHAR(20) NOT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        EnforceNicknames TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (GuildUuid),
        UNIQUE KEY UQ_Guilds_GuildId (GuildId),
        KEY IX_Guilds_GuildType (GuildType)`,
    ],
    [
        'GuildRoles',
        `GuildRoleId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        RoleType VARCHAR(32) NOT NULL,
        RoleId VARCHAR(20) NOT NULL,
        PRIMARY KEY (GuildRoleId),
        UNIQUE KEY UQ_GuildRoles_GuildRoleType (GuildUuid, RoleType),
        CONSTRAINT FK_GuildRoles_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'GuildLogChannels',
        `GuildLogChannelId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        ChannelType VARCHAR(32) NOT NULL,
        ChannelId VARCHAR(20) NOT NULL,
        PRIMARY KEY (GuildLogChannelId),
        UNIQUE KEY UQ_GuildLogChannels_GuildChannelType (GuildUuid, ChannelType),
        CONSTRAINT FK_GuildLogChannels_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'GuildLogExclusions',
        `GuildLogExclusionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        ChannelId VARCHAR(20) NOT NULL,
        AddedByDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        PRIMARY KEY (GuildLogExclusionId),
        UNIQUE KEY UQ_GuildLogExclusions_GuildChannel (GuildUuid, ChannelId),
        CONSTRAINT FK_GuildLogExclusions_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'MemberRoleSnapshots',
        `GuildUuid CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        RoleIds TEXT NOT NULL,
        LeftTimestamp DATETIME(3) NOT NULL,
        PRIMARY KEY (GuildUuid, DiscordUserId),
        CONSTRAINT FK_MemberRoleSnapshots_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'DmModMessages',
        `DmModId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        MessageText TEXT NOT NULL,
        ReportedDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
        ReportedMessage VARCHAR(500) NULL DEFAULT NULL,
        ImageFileName VARCHAR(100) NULL DEFAULT NULL,
        ChannelId VARCHAR(20) NOT NULL,
        MessageId VARCHAR(20) NULL DEFAULT NULL,
        Status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        RepliedByDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
        ReplyText TEXT NULL DEFAULT NULL,
        ReplyDelivered TINYINT(1) NULL DEFAULT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        RepliedTimestamp DATETIME(3) NULL DEFAULT NULL,
        PRIMARY KEY (DmModId),
        KEY IX_DmModMessages_DiscordUser (DiscordUserId),
        CONSTRAINT FK_DmModMessages_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'ModMails',
        `ModMailId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        OpenDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
        Title VARCHAR(100) NOT NULL,
        Inquiry TEXT NOT NULL,
        ForumChannelId VARCHAR(20) NOT NULL,
        ThreadId VARCHAR(20) NULL DEFAULT NULL,
        Status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
        PassedFromModMailId BIGINT UNSIGNED NULL DEFAULT NULL,
        FirstModReplyTimestamp DATETIME(3) NULL DEFAULT NULL,
        ClosedByDiscordUserId VARCHAR(20) NULL DEFAULT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        LastActivityTimestamp DATETIME(3) NOT NULL,
        ClosedTimestamp DATETIME(3) NULL DEFAULT NULL,
        PRIMARY KEY (ModMailId),
        UNIQUE KEY UQ_ModMails_OpenDiscordUser (OpenDiscordUserId),
        KEY IX_ModMails_Thread (ThreadId),
        KEY IX_ModMails_DiscordUser (DiscordUserId),
        CONSTRAINT FK_ModMails_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'ModMailBans',
        `GuildUuid CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        BannedByDiscordUserId VARCHAR(20) NOT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        ExpiresTimestamp DATETIME(3) NULL DEFAULT NULL,
        PRIMARY KEY (GuildUuid, DiscordUserId),
        CONSTRAINT FK_ModMailBans_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'ModSanctions',
        `SanctionId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        GuildUuid CHAR(36) NOT NULL,
        DiscordUserId VARCHAR(20) NOT NULL,
        SanctionType VARCHAR(32) NOT NULL,
        PrivateReason TEXT NULL,
        PublicReason TEXT NULL,
        Punishment VARCHAR(100) NULL,
        MessageLink VARCHAR(1000) NULL,
        SanctionLink VARCHAR(1000) NULL,
        ModeratorDiscordUserId VARCHAR(20) NOT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        ForgivenTimestamp DATETIME(3) NULL,
        ForgivenByDiscordUserId VARCHAR(20) NULL,
        PRIMARY KEY (SanctionId),
        KEY IX_ModSanctions_User (GuildUuid, DiscordUserId, CreatedTimestamp),
        CONSTRAINT FK_ModSanctions_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'ModNotes',
        `NoteId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        DiscordUserId VARCHAR(20) NOT NULL,
        OriginGuildUuid CHAR(36) NOT NULL,
        Scope VARCHAR(16) NOT NULL,
        Title VARCHAR(100) NOT NULL,
        NoteText TEXT NOT NULL,
        MessageLink VARCHAR(1000) NULL,
        AuthorDiscordUserId VARCHAR(20) NOT NULL,
        CreatedTimestamp DATETIME(3) NOT NULL,
        PRIMARY KEY (NoteId),
        KEY IX_ModNotes_User (DiscordUserId, CreatedTimestamp),
        CONSTRAINT FK_ModNotes_Guild FOREIGN KEY (OriginGuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
    [
        'ModNoteLogMessages',
        `NoteId BIGINT UNSIGNED NOT NULL,
        GuildUuid CHAR(36) NOT NULL,
        LogLink VARCHAR(1000) NOT NULL,
        PRIMARY KEY (NoteId, GuildUuid),
        CONSTRAINT FK_ModNoteLogMessages_Note FOREIGN KEY (NoteId) REFERENCES ModNotes (NoteId) ON DELETE CASCADE,
        CONSTRAINT FK_ModNoteLogMessages_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)`,
    ],
];

export const AddedColumns = [['Guilds', "EnforceNicknames TINYINT(1) NOT NULL DEFAULT 1 AFTER CreatedTimestamp"]];

export async function EnsureDatabaseExists(DatabaseConfig, { Logger } = {}) {
    const Connection = await mysql.createConnection({
        host: DatabaseConfig.Host,
        port: DatabaseConfig.Port,
        user: DatabaseConfig.User,
        password: DatabaseConfig.Password,
        connectTimeout: 10000,
    });
    try {
        const [Result] = await Connection.query(`CREATE DATABASE IF NOT EXISTS \`${DatabaseConfig.Name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
        if (Result.warningStatus === 0) {
            Logger?.Info(`Created database ${DatabaseConfig.Name}.`);
        }
    } catch (CreateError) {
        if (!['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ER_SPECIFIC_ACCESS_DENIED_ERROR'].includes(CreateError.code)) {
            throw CreateError;
        }
        Logger?.Warn(`The database user may not create databases; assuming ${DatabaseConfig.Name} already exists.`);
    } finally {
        await Connection.end();
    }
}

export async function CreateSchema(Pool, { Logger } = {}) {
    const Connection = await Pool.getConnection();
    try {
        const [LockRows] = await Connection.query('SELECT GET_LOCK(?, 30) AS Acquired', [SchemaLockName]);
        if (LockRows[0].Acquired !== 1) {
            throw new Error('Could not acquire the schema lock (another instance may be setting up the database).');
        }
        try {
            const [ExistingRows] = await Connection.query('SELECT TABLE_NAME AS TableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
            const Existing = new Set(ExistingRows.map((Row) => Row.TableName.toLowerCase()));
            const Created = [];
            for (const [TableName, Definition] of Tables) {
                if (Existing.has(TableName.toLowerCase())) {
                    continue;
                }
                await Connection.query(`CREATE TABLE IF NOT EXISTS ${TableName} (\n        ${Definition}\n    ) ${TableOptions}`);
                Created.push(TableName);
            }
            for (const [TableName, ColumnDefinition] of AddedColumns) {
                const [Result] = await Connection.query(`ALTER TABLE ${TableName} ADD COLUMN IF NOT EXISTS ${ColumnDefinition}`);
                if (Result.warningStatus === 0) {
                    Created.push(`${TableName}.${ColumnDefinition.split(' ')[0]}`);
                }
            }
            Logger?.Info(Created.length > 0 ? `Created: ${Created.join(', ')}.` : 'Database tables are up to date.');
            return Created;
        } finally {
            await Connection.query('SELECT RELEASE_LOCK(?)', [SchemaLockName]);
        }
    } finally {
        Connection.release();
    }
}
