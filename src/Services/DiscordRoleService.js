import { PermanentError } from '../Utils/RetryPolicy.js';

export class DiscordRoleService {
    constructor({ Client, Logger }) {
        this.Client = Client;
        this.Logger = Logger;
    }

    async AddRole(DiscordUserId, RoleId, Reason) {
        const { Member } = await this.ResolveMemberAndRole(DiscordUserId, RoleId);
        if (!Member.roles.cache.has(RoleId)) {
            await Member.roles.add(RoleId, Reason);
        }
    }

    async RemoveRole(DiscordUserId, RoleId, Reason) {
        const { Member } = await this.ResolveMemberAndRole(DiscordUserId, RoleId);
        if (Member.roles.cache.has(RoleId)) {
            await Member.roles.remove(RoleId, Reason);
        }
    }

    async ResolveMemberAndRole(DiscordUserId, RoleId) {
        if (!this.Client?.isReady?.()) {
            // Temporary: the bot is still connecting. The operation will be retried.
            throw new Error('Discord client is not ready.');
        }

        // Role IDs are globally unique, so the role tells us which server to use.
        const Guild = this.Client.guilds.cache.find((CandidateGuild) => CandidateGuild.roles.cache.has(RoleId));
        if (!Guild) {
            throw new PermanentError(`Role ${RoleId} was not found in any server the bot is in. Check the HABBO_ROLE_* configuration.`);
        }

        // Fetching a single member by ID does not require the privileged members intent.
        const Member = await Guild.members.fetch(DiscordUserId);
        return { Guild, Member };
    }
}
