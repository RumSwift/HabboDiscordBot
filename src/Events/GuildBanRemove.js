import { Events } from 'discord.js';

export default {
    Name: Events.GuildBanRemove,
    Once: false,
    async Execute(Ban, { Services }) {
        await Services.ModActionLogService.LogUnban(Ban);
    },
};
