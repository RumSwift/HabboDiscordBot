import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { SetupChannelChoices, SetupRoleChoices, SetupServerChoices } from '../Components/SetupComponents.js';
import { ExecuteSetupCommand } from '../Flows/SetupFlow.js';

export default {
    // Hidden without Manage Messages, and only runs for admins, moderators and head moderators (Utils/StaffAccess.js).
    StaffOnly: true,
    Data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Staff: set this server\'s type, roles and log channels.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand((Sub) =>
            Sub.setName('server')
                .setDescription('Make this Discord server the Habbo or the Origins server.')
                .addStringOption((Option) => Option.setName('type').setDescription('Which server this is').setRequired(true).addChoices(...SetupServerChoices)),
        )
        .addSubcommand((Sub) =>
            Sub.setName('channel')
                .setDescription('Set where a log goes. Leave the channel out to turn the log off.')
                .addStringOption((Option) => Option.setName('log').setDescription('Which log').setRequired(true).addChoices(...SetupChannelChoices))
                .addChannelOption((Option) =>
                    Option.setName('channel')
                        .setDescription('The channel (the mod mail one must be a forum)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread, ChannelType.GuildForum),
                ),
        )
        .addSubcommand((Sub) =>
            Sub.setName('role')
                .setDescription('Set a verified or moderator role. Leave the role out to clear it.')
                .addStringOption((Option) => Option.setName('setting').setDescription('Which role').setRequired(true).addChoices(...SetupRoleChoices))
                .addRoleOption((Option) => Option.setName('role').setDescription('The role')),
        )
        .addSubcommand((Sub) =>
            Sub.setName('nicknames')
                .setDescription('Turn forced "HabboName (HOTEL)" nicknames on or off in this server.')
                .addBooleanOption((Option) => Option.setName('enabled').setDescription('On or off').setRequired(true)),
        )
        .addSubcommand((Sub) => Sub.setName('view').setDescription('Show everything set up for this server.')),

    Execute: ExecuteSetupCommand,
};
