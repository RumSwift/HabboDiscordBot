import { Events } from 'discord.js';

export default {
    Name: Events.MessageDelete,
    Once: false,
    async Execute(Message, { Services }) {
        await Services.MessageDeleteLogService.HandleMessageDelete(Message);
    },
};
