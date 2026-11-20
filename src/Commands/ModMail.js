import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { ExecuteModMailBanCommand, ModMailBanHandlers, ModMailBanPermission } from '../Flows/ModMailBanFlow.js';
import { ModMailHandlers } from '../Flows/ModMailFlow.js';

// Mod mail itself starts from a DM; the command is for staff. Its buttons, menu and modal are registered here too.
export default {
    // Hidden without Manage Messages, and only runs for admins, moderators and head moderators (Utils/StaffAccess.js).
    StaffOnly: true,
    Data: new SlashCommandBuilder()
        .setName('modmail')
        .setDescription('Staff: manage Mod Mail in this server')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(ModMailBanPermission)
        .addSubcommand((Subcommand) =>
            Subcommand.setName('ban')
                .setDescription('Ban, unban or extend a ban from Mod Mail and /dmmod in this server')
                .addUserOption((Option) => Option.setName('user').setDescription('The user').setRequired(true)),
        ),

    async Execute(Interaction, Context) {
        if (Interaction.options.getSubcommand() === 'ban') {
            await ExecuteModMailBanCommand(Interaction, Context);
        }
    },
    ComponentHandlers: { ...ModMailHandlers.ComponentHandlers, ...ModMailBanHandlers },
    ModalHandlers: ModMailHandlers.ModalHandlers,
};
