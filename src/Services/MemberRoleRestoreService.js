const RestoreReason = 'Restoring roles after rejoining the server';

// Remembers a member's roles when they leave a configured server and gives them back when they rejoin.
// Verification roles (GuildRoles) are left out: the Habbo link decides those, so an unlinked member
// does not get a verified role back.
export class MemberRoleRestoreService {
    constructor({ SnapshotRepository, GuildConfigurationRepository, Logger, Clock = () => new Date() }) {
        this.SnapshotRepository = SnapshotRepository;
        this.GuildConfigurationRepository = GuildConfigurationRepository;
        this.Logger = Logger;
        this.Clock = Clock;
    }

    async HandleMemberLeave(Member) {
        // Without the cached member there is no role list to save.
        if (Member.partial || Member.user?.bot) {
            return false;
        }
        const GuildId = Member.guild.id;
        const VerificationRoleIds = await this.GuildConfigurationRepository.GetRoleIdsForGuild(GuildId);
        const RoleIds = [...(Member.roles?.cache?.values() ?? [])]
            .filter((Role) => Role.id !== GuildId && !Role.managed && !VerificationRoleIds.has(Role.id))
            .map((Role) => Role.id);

        if (RoleIds.length === 0) {
            await this.SnapshotRepository.Delete(GuildId, Member.id);
            return false;
        }
        const Saved = await this.SnapshotRepository.Save(GuildId, Member.id, RoleIds, this.Clock());
        if (Saved) {
            this.Logger?.Debug('Saved roles of departing member', { DiscordUserId: Member.id, GuildId, RoleCount: RoleIds.length });
        }
        return Saved;
    }

    async HandleMemberJoin(Member) {
        if (Member.user?.bot) {
            return [];
        }
        const GuildId = Member.guild.id;
        const Snapshot = await this.SnapshotRepository.Find(GuildId, Member.id);
        if (!Snapshot) {
            return [];
        }

        const Restorable = [];
        const Skipped = [];
        for (const RoleId of Snapshot.RoleIds) {
            const Role = Member.guild.roles.cache.get(RoleId);
            // Deleted roles, integration roles and roles above the bot can't be given.
            if (Role && !Role.managed && Role.editable) {
                Restorable.push(RoleId);
            } else {
                Skipped.push(RoleId);
            }
        }
        if (Skipped.length > 0) {
            this.Logger?.Warn('Some roles could not be restored (deleted, managed, or above the bot\'s highest role)', { DiscordUserId: Member.id, GuildId, RoleIds: Skipped });
        }

        if (Restorable.length > 0) {
            // Throws on failure, leaving the snapshot so nothing is lost.
            await Member.roles.add(Restorable, RestoreReason);
            this.Logger?.Info('Restored roles of rejoining member', { DiscordUserId: Member.id, GuildId, RoleCount: Restorable.length });
        }
        await this.SnapshotRepository.Delete(GuildId, Member.id);
        return Restorable;
    }
}
