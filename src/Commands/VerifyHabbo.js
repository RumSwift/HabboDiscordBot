import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { VerifyCommandName } from '../Components/ComponentStyles.js';
import {
    ExecuteVerifyHabboCommand,
    HandleCancel,
    HandleCheckMotto,
    HandleDashboard,
    HandleLink,
    HandleSelectGame,
    HandleSelectHotel,
    HandleUsernameModal,
} from '../Flows/VerificationFlow.js';
import { HandleConfirmUnlink, HandleUnlink, HandleUnlinkGame } from '../Flows/UnlinkFlow.js';

export default {
    Data: new SlashCommandBuilder()
        .setName(VerifyCommandName)
        .setDescription('Link your Discord account to your Habbo and Habbo Origins accounts.')
        .setContexts(InteractionContextType.Guild),

    async Execute(Interaction, Context) {
        await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await ExecuteVerifyHabboCommand(Interaction, Context);
    },

    ComponentHandlers: {
        Dashboard: HandleDashboard,
        Link: HandleLink,
        SelectGame: HandleSelectGame,
        SelectHotel: HandleSelectHotel,
        TryAgain: HandleSelectHotel,
        CheckMotto: HandleCheckMotto,
        Cancel: HandleCancel,
        Unlink: HandleUnlink,
        UnlinkGame: HandleUnlinkGame,
        ConfirmUnlink: HandleConfirmUnlink,
    },

    ModalHandlers: {
        UsernameModal: HandleUsernameModal,
    },
};
