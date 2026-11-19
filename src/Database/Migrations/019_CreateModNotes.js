// Notes moderators add to a member from /modpanel. A GLOBAL note is seen in every server; a SERVER note only where it was added.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS ModNotes (
            NoteId BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
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
            CONSTRAINT FK_ModNotes_Guild FOREIGN KEY (OriginGuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    // Where each note was logged, per server, so a server's moderators can be linked to their own copy.
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS ModNoteLogMessages (
            NoteId BIGINT UNSIGNED NOT NULL,
            GuildUuid CHAR(36) NOT NULL,
            LogLink VARCHAR(1000) NOT NULL,
            PRIMARY KEY (NoteId, GuildUuid),
            CONSTRAINT FK_ModNoteLogMessages_Note FOREIGN KEY (NoteId) REFERENCES ModNotes (NoteId) ON DELETE CASCADE,
            CONSTRAINT FK_ModNoteLogMessages_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);

    // Each server's notes log channel. INSERT IGNORE keeps any row already set by hand.
    const Channels = [
        ['HABBO', '1571971525957918761'],
        ['ORIGINS', '1571971577568956496'],
    ];
    for (const [GuildType, ChannelId] of Channels) {
        await Connection.query("INSERT IGNORE INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) SELECT GuildUuid, 'NOTES', ? FROM Guilds WHERE GuildType = ?", [ChannelId, GuildType]);
    }
}
