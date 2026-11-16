import { Events } from 'discord.js';
import { HandleModMailDirectMessage, HandleModMailThreadMessage } from '../Flows/ModMailFlow.js';

export default {
    Name: Events.MessageCreate,
    Once: false,
    async Execute(Message, { Logger, Services }) {
        const Context = { Logger, Services };
        if (Message.guildId) {
            await HandleModMailThreadMessage(Message, Context);
        } else {
            await HandleModMailDirectMessage(Message, Context);
        }
    },
};
