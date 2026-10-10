import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { VerifyCommandName } from '../Components/ComponentStyles.js';
import {
    ExecuteVerifyHabboCommand,
    HandleCancel,
    HandleCheckMotto,
    HandleDashboard,
    HandleLink,
    HandleSelectHotel,
    HandleUsernameModal,
} from '../Flows/VerificationFlow.js';
import { HandleConfirmUnlink, HandleUnlink } from '../Flows/UnlinkFlow.js';

export default {
    // Discord only allows lowercase command names, so "VerifyHabbo" is registered as "verifyhabbo".
    Data: new SlashCommandBuilder()
        .setName(VerifyCommandName)
        .setDescription('Link your Discord account to your Habbo account.')
        .setContexts(InteractionContextType.Guild),

    async Execute(Interaction, Context) {
        await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await ExecuteVerifyHabboCommand(Interaction, Context);
    },

    ComponentHandlers: {
        Dashboard: HandleDashboard,
        Link: HandleLink,
        SelectHotel: HandleSelectHotel,
        TryAgain: HandleSelectHotel,
        CheckMotto: HandleCheckMotto,
        Cancel: HandleCancel,
        Unlink: HandleUnlink,
        ConfirmUnlink: HandleConfirmUnlink,
    },

    ModalHandlers: {
        UsernameModal: HandleUsernameModal,
    },
};
