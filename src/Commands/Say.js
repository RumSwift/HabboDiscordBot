import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AuditPermission } from '../Flows/AuditFlow.js';
import { ExecuteSayCommand } from '../Flows/SayFlow.js';

export default {
    Data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Staff: send a message as the bot.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(AuditPermission)
        .addStringOption((Option) => Option.setName('message').setDescription('What to say. Type \\n for a new line.').setRequired(true).setMaxLength(2000))
        .addChannelOption((Option) =>
            Option.setName('channel')
                .setDescription('Where to send it (defaults to this channel)')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.GuildVoice,
                    ChannelType.PublicThread,
                    ChannelType.PrivateThread,
                    ChannelType.AnnouncementThread,
                ),
        ),

    Execute: ExecuteSayCommand,
};
