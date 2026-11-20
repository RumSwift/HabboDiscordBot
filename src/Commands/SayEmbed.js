import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { SayEmbedModalAction, SayEmbedRetryAction } from '../Components/SayComponents.js';
import { AuditPermission } from '../Flows/AuditFlow.js';
import { ExecuteSayEmbedCommand, HandleSayEmbedModal, HandleSayEmbedRetry } from '../Flows/SayFlow.js';

export default {
    // Hidden without Manage Messages, and only runs for admins, moderators and head moderators (Utils/StaffAccess.js).
    StaffOnly: true,
    Data: new SlashCommandBuilder()
        .setName('sayembed')
        .setDescription('Staff: send an embed as the bot. Opens a form for the title, content and colour.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(AuditPermission)
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
        )
        .addStringOption((Option) => Option.setName('image_link').setDescription('Link to an image for the embed (used instead of an upload)').setMaxLength(2000))
        .addAttachmentOption((Option) => Option.setName('image_upload').setDescription('Image for the embed (ignored when an image link is given)'))
        .addRoleOption((Option) => Option.setName('tag').setDescription('Role to ping above the embed (pick @everyone to ping everyone)'))
        .addBooleanOption((Option) => Option.setName('tag_here').setDescription('Ping @here above the embed (instead of a role)')),

    Execute: ExecuteSayEmbedCommand,
    ModalHandlers: { [SayEmbedModalAction]: HandleSayEmbedModal },
    ComponentHandlers: { [SayEmbedRetryAction]: HandleSayEmbedRetry },
};
