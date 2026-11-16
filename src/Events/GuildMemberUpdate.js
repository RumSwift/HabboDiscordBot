import { Events } from 'discord.js';

export default {
    Name: Events.GuildMemberUpdate,
    Once: false,
    async Execute(OldMember, NewMember, { NicknameService, Services, Logger }) {
        // Logged separately so a logging problem can't stop the nickname check.
        await Services?.RoleChangeLogService?.HandleMemberUpdate(OldMember, NewMember).catch((LogError) => Logger.Error('Could not log role changes', { Error: LogError }));
        if (!NicknameService) {
            return;
        }
        // Ignore role / avatar changes. OldMember may be partial (not cached), in which case we check anyway.
        if (!OldMember.partial && OldMember.nickname === NewMember.nickname) {
            return;
        }
        await NicknameService.HandleMemberUpdate(NewMember);
    },
};
