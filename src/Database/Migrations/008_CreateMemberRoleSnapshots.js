// The roles a member had when they left a server, given back when they rejoin.
export async function Up(Connection) {
    await Connection.query(`
        CREATE TABLE IF NOT EXISTS MemberRoleSnapshots (
            GuildUuid CHAR(36) NOT NULL,
            DiscordUserId VARCHAR(20) NOT NULL,
            RoleIds TEXT NOT NULL,
            LeftTimestamp DATETIME(3) NOT NULL,
            PRIMARY KEY (GuildUuid, DiscordUserId),
            CONSTRAINT FK_MemberRoleSnapshots_Guild FOREIGN KEY (GuildUuid) REFERENCES Guilds (GuildUuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `);
}
