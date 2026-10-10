import { Events } from 'discord.js';

export default {
    Name: Events.InteractionCreate,
    Once: false,
    async Execute(Interaction, { InteractionHandler }) {
        await InteractionHandler.HandleInteraction(Interaction);
    },
};
