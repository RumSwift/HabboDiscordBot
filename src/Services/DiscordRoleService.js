import { PermanentError } from '../Utils/RetryPolicy.js';

export class DiscordRoleService {
    constructor({ Client, Logger }) {
        this.Client = Client;
        this.Logger = Logger;
    }

    async AddRole(DiscordUserId, RoleId, Reason, GuildId = null) {
        const { Member } = await this.ResolveMemberAndRole(DiscordUserId, RoleId, GuildId);
        if (!Member.roles.cache.has(RoleId)) {
            await Member.roles.add(RoleId, Reason);
        }
    }

    async RemoveRole(DiscordUserId, RoleId, Reason, GuildId = null) {
        const { Member } = await this.ResolveMemberAndRole(DiscordUserId, RoleId, GuildId);
        if (Member.roles.cache.has(RoleId)) {
            await Member.roles.remove(RoleId, Reason);
        }
    }

    async ResolveMemberAndRole(DiscordUserId, RoleId, GuildId) {
        if (!this.Client?.isReady?.()) {
            // Temporary: the bot is still connecting. The operation will be retried.
            throw new Error('Discord client is not ready.');
        }

        // Operations queued before servers were configured have no GuildId; the role tells us the server.
        const Guild = GuildId
            ? this.Client.guilds.cache.get(GuildId)
            : this.Client.guilds.cache.find((CandidateGuild) => CandidateGuild.roles.cache.has(RoleId));
        if (!Guild) {
            throw new PermanentError(GuildId ? `The bot is not in server ${GuildId}.` : `Role ${RoleId} was not found in any server the bot is in.`);
        }
        if (!Guild.roles.cache.has(RoleId)) {
            throw new PermanentError(`Role ${RoleId} does not exist in server ${Guild.id}. Check the GuildRoles table.`);
        }

        const Member = await Guild.members.fetch(DiscordUserId);
        return { Guild, Member };
    }
}
