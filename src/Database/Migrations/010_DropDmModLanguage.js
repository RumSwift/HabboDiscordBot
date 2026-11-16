// /dmmod no longer asks for a language: each server has one thread.
export async function Up(Connection) {
    await Connection.query('ALTER TABLE DmModMessages DROP COLUMN IF EXISTS Language');
}
