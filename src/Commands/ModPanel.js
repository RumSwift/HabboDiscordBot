import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { ExecuteModPanelCommand, ModPanelHandlers, ModPanelModalHandlers, ModPanelPermission } from './ModPanel/Panel.js';

export default {
    Data: new SlashCommandBuilder()
        .setName('modpanel')
        .setDescription('Open moderation panel for a user')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(ModPanelPermission)
        .addUserOption((Option) => Option.setName('user').setDescription('User to moderate').setRequired(true)),

    Execute: ExecuteModPanelCommand,
    ComponentHandlers: ModPanelHandlers,
    ModalHandlers: ModPanelModalHandlers,
};
