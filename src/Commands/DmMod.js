import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { DmModReplyAction, DmModReplyModalAction, MaxDmModTextLength } from '../Components/DmModComponents.js';
import { ExecuteDmModCommand, HandleDmModReplyButton, HandleDmModReplyModal } from '../Flows/DmModFlow.js';

export default {
    Data: new SlashCommandBuilder()
        .setName('dmmod')
        .setDescription('Send a message to the moderation team')
        .setContexts(InteractionContextType.Guild)
        .addStringOption((Option) => Option.setName('text').setDescription('Your message to the moderation team').setRequired(true).setMaxLength(MaxDmModTextLength))
        .addUserOption((Option) => Option.setName('reported_player').setDescription('Player you want to report (optional)'))
        .addStringOption((Option) => Option.setName('reported_message').setDescription('Link to the message you want to report (optional)').setMaxLength(500))
        .addAttachmentOption((Option) => Option.setName('image').setDescription('Upload an image as evidence (optional)')),

    Execute: ExecuteDmModCommand,
    ComponentHandlers: { [DmModReplyAction]: HandleDmModReplyButton },
    ModalHandlers: { [DmModReplyModalAction]: HandleDmModReplyModal },
};
