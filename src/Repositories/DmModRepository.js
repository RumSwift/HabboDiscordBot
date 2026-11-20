export const DmModStatuses = Object.freeze({ Open: 'OPEN', Replied: 'REPLIED' });

const DmModColumns = `d.DmModId, g.GuildId, g.GuildType, d.DiscordUserId, d.MessageText, d.ReportedDiscordUserId, d.ReportedMessage,
                      d.ImageFileName, d.ChannelId, d.MessageId, d.Status, d.RepliedByDiscordUserId, d.ReplyText, d.ReplyDelivered, d.CreatedTimestamp, d.RepliedTimestamp`;

export class DmModRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    async Create({ GuildId, DiscordUserId, MessageText, ReportedDiscordUserId = null, ReportedMessage = null, ImageFileName = null, ChannelId, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            `INSERT INTO DmModMessages (GuildUuid, DiscordUserId, MessageText, ReportedDiscordUserId, ReportedMessage, ImageFileName, ChannelId, Status, CreatedTimestamp)
             SELECT GuildUuid, ?, ?, ?, ?, ?, ?, 'OPEN', ? FROM Guilds WHERE GuildId = ?`,
            [DiscordUserId, MessageText, ReportedDiscordUserId, ReportedMessage, ImageFileName, ChannelId, Now, GuildId],
        );
        return Result.affectedRows > 0 ? String(Result.insertId) : null;
    }

    async SetMessageId(DmModId, MessageId) {
        await this.Pool.query('UPDATE DmModMessages SET MessageId = ? WHERE DmModId = ?', [MessageId, DmModId]);
    }

    async Delete(DmModId) {
        await this.Pool.query('DELETE FROM DmModMessages WHERE DmModId = ?', [DmModId]);
    }

    async FindById(DmModId) {
        const [Rows] = await this.Pool.query(`SELECT ${DmModColumns} FROM DmModMessages d JOIN Guilds g ON g.GuildUuid = d.GuildUuid WHERE d.DmModId = ?`, [DmModId]);
        return Rows[0] ? { ...Rows[0], DmModId: String(Rows[0].DmModId) } : null;
    }

    async ClaimReply(DmModId, { RepliedByDiscordUserId, ReplyText, Now = new Date() }) {
        const [Result] = await this.Pool.query(
            "UPDATE DmModMessages SET Status = 'REPLIED', RepliedByDiscordUserId = ?, ReplyText = ?, RepliedTimestamp = ? WHERE DmModId = ? AND Status = 'OPEN'",
            [RepliedByDiscordUserId, ReplyText, Now, DmModId],
        );
        return Result.affectedRows > 0;
    }

    async SetReplyDelivered(DmModId, Delivered) {
        await this.Pool.query('UPDATE DmModMessages SET ReplyDelivered = ? WHERE DmModId = ?', [Delivered ? 1 : 0, DmModId]);
    }
}
