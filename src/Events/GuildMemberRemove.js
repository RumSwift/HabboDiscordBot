import { Events } from 'discord.js';

export default {
    Name: Events.GuildMemberRemove,
    Once: false,
    async Execute(Member, { Logger, Services }) {
        // Saved separately so a logging problem can't lose the member's roles.
        await Services.MemberRoleRestoreService?.HandleMemberLeave(Member).catch((SaveError) => Logger.Error('Could not save roles of departing member', { DiscordUserId: Member.id, Error: SaveError }));
        await Services.MemberLeaveLogService.HandleMemberLeave(Member);
    },
};
