import { Events } from 'discord.js';

export default {
    Name: Events.MessageUpdate,
    Once: false,
    async Execute(OldMessage, NewMessage, { Services }) {
        await Services.MessageEditLogService.HandleMessageUpdate(OldMessage, NewMessage);
    },
};
