// Temporary mod mail bans: ExpiresTimestamp is NULL for a permanent ban.
export async function Up(Connection) {
    await Connection.query('ALTER TABLE ModMailBans ADD COLUMN IF NOT EXISTS ExpiresTimestamp DATETIME(3) NULL DEFAULT NULL AFTER CreatedTimestamp');
}
