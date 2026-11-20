import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AuditPermission, ExecuteVerifyAuditCommand, HandleAuditHistory, HandleAuditSummary } from '../Flows/AuditFlow.js';

export default {
    StaffOnly: true,
    Data: new SlashCommandBuilder()
        .setName('verifyaudit')
        .setDescription('Staff: view a member\'s Habbo link history.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(AuditPermission)
        .addUserOption((Option) => Option.setName('user').setDescription('The Discord user to look up').setRequired(true)),

    Execute: ExecuteVerifyAuditCommand,

    ComponentHandlers: {
        AuditSummary: HandleAuditSummary,
        AuditHistory: HandleAuditHistory,
    },
};
