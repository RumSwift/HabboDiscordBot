import { Events } from 'discord.js';
import { HandleMemberJoin } from '../Flows/MemberJoinFlow.js';

export default {
    Name: Events.GuildMemberAdd,
    Once: false,
    async Execute(Member, { Logger, Services }) {
        await HandleMemberJoin(Member, { Logger, Services });
    },
};
