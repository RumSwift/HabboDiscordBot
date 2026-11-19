import { randomUUID } from 'node:crypto';
import { WithTransaction } from '../Database/DatabaseConnection.js';
import { Games } from '../Utils/HotelConfiguration.js';

export const LogChannelTypes = Object.freeze({
    Verification: 'VERIFICATION',
    MessageDelete: 'MESSAGE_DELETE',
    MessageEdit: 'MESSAGE_EDIT',
    RoleAdd: 'ROLE_ADD',
    RoleRemove: 'ROLE_REMOVE',
    MemberJoin: 'MEMBER_JOIN',
    MemberLeave: 'MEMBER_LEAVE',
    Say: 'SAY',
    DmMod: 'DMMOD',
    ModMailForum: 'MODMAIL_FORUM',
    ModActions: 'MOD_ACTIONS',
    BanLog: 'BAN_LOG',
    DirectMessages: 'DIRECT_MESSAGES',
    Notes: 'NOTES',
});

// Role pinged on /dmmod messages (GuildRoles.RoleType).
export const DmModPingRoleType = 'COM_MOD';

export const ExclusionOutcomes = Object.freeze({
    NotConfigured: 'NOT_CONFIGURED',
    Added: 'ADDED',
    AlreadyExcluded: 'ALREADY_EXCLUDED',
    Removed: 'REMOVED',
    NotExcluded: 'NOT_EXCLUDED',
});

export class GuildConfigurationRepository {
    constructor(Pool) {
        this.Pool = Pool;
    }

    // Fills the tables from .env only while Guilds is empty; after that the tables are edited directly.
    async SeedIfEmpty(GuildSeed, { Logger, Now = new Date() } = {}) {
        return WithTransaction(this.Pool, async (Connection) => {
            const [Existing] = await Connection.query('SELECT COUNT(*) AS GuildCount FROM Guilds FOR UPDATE');
            if (Number(Existing[0].GuildCount) > 0) {
                return false;
            }
            if (GuildSeed.length === 0) {
                Logger?.Warn('The Guilds table is empty. Set HABBO_GUILD_ID / ORIGINS_GUILD_ID to seed it, or add rows by hand.');
                return false;
            }

            for (const Guild of GuildSeed) {
                const GuildUuid = randomUUID();
                await Connection.query('INSERT INTO Guilds (GuildUuid, GuildType, Name, GuildId, CreatedTimestamp) VALUES (?, ?, ?, ?, ?)', [
                    GuildUuid,
                    Guild.GuildType,
                    Guild.Name,
                    Guild.GuildId,
                    Now,
                ]);
                for (const Role of Guild.Roles) {
                    await Connection.query('INSERT INTO GuildRoles (GuildUuid, RoleType, RoleId) VALUES (?, ?, ?)', [GuildUuid, Role.RoleType, Role.RoleId]);
                }
                for (const Channel of Guild.LogChannels) {
                    await Connection.query('INSERT INTO GuildLogChannels (GuildUuid, ChannelType, ChannelId) VALUES (?, ?, ?)', [GuildUuid, Channel.ChannelType, Channel.ChannelId]);
                    // Notifications queued before servers were configured have no channel; send them to the Habbo log.
                    if (Guild.GuildType === Games.Habbo && Channel.ChannelType === LogChannelTypes.Verification) {
                        await Connection.query(
                            "UPDATE AuditNotificationOutbox SET ChannelId = ? WHERE ChannelId IS NULL AND Status IN ('PENDING', 'PROCESSING')",
                            [Channel.ChannelId],
                        );
                    }
                }
                Logger?.Info(`Seeded server configuration: ${Guild.Name}`, { GuildId: Guild.GuildId, Roles: Guild.Roles.length, LogChannels: Guild.LogChannels.length });
            }
            return true;
        });
    }

    async GetGuilds(Executor = this.Pool) {
        const [Rows] = await Executor.query('SELECT GuildUuid, GuildType, Name, GuildId FROM Guilds ORDER BY Name');
        return Rows;
    }

    async GetGuildTypesById(Executor = this.Pool) {
        const Guilds = await this.GetGuilds(Executor);
        return new Map(Guilds.map((Guild) => [Guild.GuildId, Guild.GuildType]));
    }

    async FindGuildByGuildId(GuildId, Executor = this.Pool) {
        const [Rows] = await Executor.query('SELECT GuildUuid, GuildType, Name, GuildId FROM Guilds WHERE GuildId = ?', [GuildId]);
        return Rows[0] ?? null;
    }

    async GetRoles(GuildType, RoleType, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT g.GuildId, r.RoleId
             FROM GuildRoles r
             JOIN Guilds g ON g.GuildUuid = r.GuildUuid
             WHERE g.GuildType = ? AND r.RoleType = ?`,
            [GuildType, RoleType],
        );
        return Rows;
    }

    // Every verification role configured for one server.
    async GetRoleIdsForGuild(GuildId, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT r.RoleId
             FROM GuildRoles r
             JOIN Guilds g ON g.GuildUuid = r.GuildUuid
             WHERE g.GuildId = ? AND r.RoleType LIKE 'VERIFIED\\_%'`,
            [GuildId],
        );
        return new Set(Rows.map((Row) => Row.RoleId));
    }

    async GetRoleId(GuildId, RoleType, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT r.RoleId
             FROM GuildRoles r
             JOIN Guilds g ON g.GuildUuid = r.GuildUuid
             WHERE g.GuildId = ? AND r.RoleType = ?`,
            [GuildId, RoleType],
        );
        return Rows[0]?.RoleId ?? null;
    }

    async GetLogChannels(ChannelType, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT g.GuildId, g.GuildType, c.ChannelId
             FROM GuildLogChannels c
             JOIN Guilds g ON g.GuildUuid = c.GuildUuid
             WHERE c.ChannelType = ?
             ORDER BY g.Name`,
            [ChannelType],
        );
        return Rows;
    }

    async GetLogChannelId(GuildId, ChannelType, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT c.ChannelId
             FROM GuildLogChannels c
             JOIN Guilds g ON g.GuildUuid = c.GuildUuid
             WHERE g.GuildId = ? AND c.ChannelType = ?`,
            [GuildId, ChannelType],
        );
        return Rows[0]?.ChannelId ?? null;
    }

    async GetExcludedChannelIds(GuildId, Executor = this.Pool) {
        const [Rows] = await Executor.query(
            `SELECT e.ChannelId
             FROM GuildLogExclusions e
             JOIN Guilds g ON g.GuildUuid = e.GuildUuid
             WHERE g.GuildId = ?`,
            [GuildId],
        );
        return new Set(Rows.map((Row) => Row.ChannelId));
    }

    async AddExcludedChannel(GuildId, ChannelId, AddedByDiscordUserId, Now = new Date()) {
        const Guild = await this.FindGuildByGuildId(GuildId);
        if (!Guild) {
            return ExclusionOutcomes.NotConfigured;
        }
        try {
            await this.Pool.query('INSERT INTO GuildLogExclusions (GuildUuid, ChannelId, AddedByDiscordUserId, CreatedTimestamp) VALUES (?, ?, ?, ?)', [
                Guild.GuildUuid,
                ChannelId,
                AddedByDiscordUserId,
                Now,
            ]);
            return ExclusionOutcomes.Added;
        } catch (InsertError) {
            if (InsertError.code === 'ER_DUP_ENTRY') {
                return ExclusionOutcomes.AlreadyExcluded;
            }
            throw InsertError;
        }
    }

    async RemoveExcludedChannel(GuildId, ChannelId) {
        const Guild = await this.FindGuildByGuildId(GuildId);
        if (!Guild) {
            return ExclusionOutcomes.NotConfigured;
        }
        const [Result] = await this.Pool.query('DELETE FROM GuildLogExclusions WHERE GuildUuid = ? AND ChannelId = ?', [Guild.GuildUuid, ChannelId]);
        return Result.affectedRows > 0 ? ExclusionOutcomes.Removed : ExclusionOutcomes.NotExcluded;
    }
}
