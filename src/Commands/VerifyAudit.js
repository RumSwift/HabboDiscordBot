import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AuditPermission, ExecuteVerifyAuditCommand, HandleAuditHistory, HandleAuditSummary } from '../Flows/AuditFlow.js';

export default {
    // Discord only allows lowercase command names, so "VerifyAudit" is registered as "verifyaudit".
    Data: new SlashCommandBuilder()
        .setName('verifyaudit')
        .setDescription('Staff: view a member\'s Habbo link history.')
        .setContexts(InteractionContextType.Guild)
        // Hidden from, and unusable by, members without Manage Messages (unless an admin overrides it).
        .setDefaultMemberPermissions(AuditPermission)
        .addUserOption((Option) => Option.setName('user').setDescription('The Discord user to look up').setRequired(true)),

    Execute: ExecuteVerifyAuditCommand,

    ComponentHandlers: {
        AuditSummary: HandleAuditSummary,
        AuditHistory: HandleAuditHistory,
    },
};
