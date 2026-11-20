import { PermissionFlagsBits } from 'discord.js';
import { DmModPingRoleType, HeadModRoleType } from '../Repositories/GuildConfigurationRepository.js';

export const StaffPermission = PermissionFlagsBits.ManageMessages;

function MemberRoleIds(Member) {
    if (!Member) {
        return [];
    }
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
