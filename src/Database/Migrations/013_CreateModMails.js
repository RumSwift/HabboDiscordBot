// Mod mail conversations: a member DMs the bot and talks to one server's mod team through a forum thread.
// OpenDiscordUserId is set only while the mail is open, so the unique key allows one open mail per member
// across both teams.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS ModMails (
            ModMailId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
            CONSTRAINT FK_ModMails_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
