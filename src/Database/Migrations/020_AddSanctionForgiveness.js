// A forgiven sanction stays in the table for the record, but no longer shows in the member's history or counts towards their next sanction.
export async function Up(Connection) {
    await Connection.query(`
        ALTER TABLE ModSanctions
            ADD COLUMN IF NOT EXISTS ForgivenTimestamp DATETIME(3) NULL,
            ADD COLUMN IF NOT EXISTS ForgivenByDiscordUserId VARCHAR(20) NULL
    `);
}
