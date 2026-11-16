// Whether a moderator's /dmmod reply reached the member (false when their DMs are closed).
export async function Up(Connection) {
    await Connection.query('ALTER TABLE DmModMessages ADD COLUMN IF NOT EXISTS ReplyDelivered TINYINT(1) NULL DEFAULT NULL AFTER ReplyText');
}
