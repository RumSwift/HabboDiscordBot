import { Events } from 'discord.js';
import { HandleMemberJoin } from '../Flows/MemberJoinFlow.js';

export default {
    Name: Events.GuildMemberAdd,
    Once: false,
    async Execute(Member, { Logger, Services }) {
        await Services.MemberJoinLogService?.HandleMemberJoin(Member).catch((LogError) => Logger.Error('Could not log member join', { Error: LogError }));
        await Services.MemberRoleRestoreService?.HandleMemberJoin(Member).catch((RestoreError) => Logger.Error('Could not restore roles of rejoining member', { DiscordUserId: Member.id, Error: RestoreError }));
        await HandleMemberJoin(Member, { Logger, Services });
    },
};
