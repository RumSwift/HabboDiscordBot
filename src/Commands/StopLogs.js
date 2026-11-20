import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AuditPermission } from '../Flows/AuditFlow.js';
import { ExecuteStopLogsCommand } from '../Flows/LogExclusionFlow.js';

export default {
    StaffOnly: true,
    HeadModOnly: true,
    Data: new SlashCommandBuilder()
        .setName('stoplogs')
        .setDescription('Staff: stop logging a channel (or every channel in a category).')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(AuditPermission)
        .addChannelOption((Option) => Option.setName('channel').setDescription('The channel or category to stop logging').setRequired(true)),

    Execute: ExecuteStopLogsCommand,
};
