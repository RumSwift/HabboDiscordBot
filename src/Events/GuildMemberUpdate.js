import { Events } from 'discord.js';

export default {
    Name: Events.GuildMemberUpdate,
    Once: false,
    async Execute(OldMember, NewMember, { NicknameService, Services, Logger }) {
        await Services?.RoleChangeLogService?.HandleMemberUpdate(OldMember, NewMember).catch((LogError) => Logger.Error('Could not log role changes', { Error: LogError }));
        if (!NicknameService) {
            return;
        }
        if (!OldMember.partial && OldMember.nickname === NewMember.nickname) {
            return;
        }
        await NicknameService.HandleMemberUpdate(NewMember);
    },
};
