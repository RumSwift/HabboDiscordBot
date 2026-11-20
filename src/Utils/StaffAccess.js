import { PermissionFlagsBits } from 'discord.js';
import { DmModPingRoleType, HeadModRoleType } from '../Repositories/GuildConfigurationRepository.js';

// Staff commands are hidden from members without Manage Messages (each command's default permission).
// On top of that, the bot itself only lets them run for:
//  - server administrators, or
//  - members with Manage Messages who also have this server's moderator or head moderator role (set with /setup role).
// Until those roles are set, only administrators can use the staff commands.
export const StaffPermission = PermissionFlagsBits.ManageMessages;

function MemberRoleIds(Member) {
    if (!Member) {
        return [];
    }
    // A cached GuildMember has roles.cache; an uncached API member has a plain array.
    return Array.isArray(Member.roles) ? Member.roles : [...(Member.roles?.cache?.keys?.() ?? [])];
}

export async function IsStaff(Interaction, GuildConfigurationRepository) {
    const Permissions = Interaction.memberPermissions;
    if (!Interaction.guildId || !Permissions) {
        return false;
    }
    if (Permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }
    if (!Permissions.has(StaffPermission)) {
        return false;
    }
    const StaffRoleIds = await Promise.all([DmModPingRoleType, HeadModRoleType].map((Type) => GuildConfigurationRepository.GetRoleId(Interaction.guildId, Type)));
    const Held = new Set(MemberRoleIds(Interaction.member));
    return StaffRoleIds.some((RoleId) => RoleId && Held.has(RoleId));
}

export const StaffOnlyMessage = 'Only server administrators, moderators and head moderators can use this command.';
