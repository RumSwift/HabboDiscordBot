import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AuditPermission } from '../Flows/AuditFlow.js';
import { ExecuteStartLogsCommand } from '../Flows/LogExclusionFlow.js';

export default {
    Data: new SlashCommandBuilder()
        .setName('startlogs')
        .setDescription('Staff: log a channel again after /stoplogs.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(AuditPermission)
        .addChannelOption((Option) => Option.setName('channel').setDescription('The channel or category to log again').setRequired(true)),

    Execute: ExecuteStartLogsCommand,
};
