import { MessageFlags } from 'discord.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import {
    BuildDmModCard,
    BuildDmModReceiptView,
    BuildDmModReplyDmView,
    BuildDmModReplyModal,
    BuildDmModResultView,
    DmModReplyInputId,
    ReplyNotDeliveredNote,
} from '../Components/DmModComponents.js';
import { DmModPingRoleType, LogChannelTypes } from '../Repositories/GuildConfigurationRepository.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

const NotConfiguredText = 'Moderation channel not found. Contact Habbo Staff.';

function ImageFileName(Attachment) {
    const Extension = (Attachment.name?.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] ?? 'png').toLowerCase();
    return `Evidence.${Extension}`;
}

async function FetchTextChannel(Client, ChannelId) {
    const Channel = ChannelId ? await Client.channels.fetch(ChannelId).catch(() => null) : null;
    return Channel?.isTextBased?.() && typeof Channel.send === 'function' ? Channel : null;
}

function FetchPingRoleId(Context, GuildId) {
    return Context.Services.GuildConfigurationRepository.GetRoleId(GuildId, DmModPingRoleType);
}

export async function ExecuteDmModCommand(Interaction, Context) {
    const { GuildConfigurationRepository, DmModRepository } = Context.Services;
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const Text = Interaction.options.getString('text', true);
    const ReportedUser = Interaction.options.getUser('reported_player');
    const ReportedMessage = Interaction.options.getString('reported_message');
    const Image = Interaction.options.getAttachment('image');
    const GuildId = Interaction.guildId;

    if (await Context.Services.ModMailBanRepository.IsBanned(GuildId, Interaction.user.id)) {
        await Interaction.editReply(
            BuildDmModResultView('🚫 Access Restricted', 'Your access to contact the moderation team of this server has been restricted.', { Success: false }),
        );
        return;
    }

    if (Image && !/^image\//.test(Image.contentType ?? '')) {
        await Interaction.editReply(BuildDmModResultView('Message Not Sent', 'The evidence must be an image (PNG, JPG, GIF or WEBP).', { Success: false }));
        return;
    }

    const Guild = await GuildConfigurationRepository.FindGuildByGuildId(GuildId);
    const ChannelId = Guild ? await GuildConfigurationRepository.GetLogChannelId(GuildId, LogChannelTypes.DmMod) : null;
    const Channel = await FetchTextChannel(Interaction.client, ChannelId);
    if (!Channel) {
        Context.Logger.Warn('/dmmod used but the server has no reachable DMMOD thread. Check the GuildLogChannels table.', { GuildId, ChannelId });
        await Interaction.editReply(BuildDmModResultView('Message Not Sent', NotConfiguredText, { Success: false }));
        return;
    }

    const DmModId = await DmModRepository.Create({
        GuildId,
        DiscordUserId: Interaction.user.id,
        MessageText: Text,
        ReportedDiscordUserId: ReportedUser?.id ?? null,
        ReportedMessage,
        ImageFileName: Image ? ImageFileName(Image) : null,
        ChannelId: Channel.id,
    });
    const DmMod = await DmModRepository.FindById(DmModId);
    const PingRoleId = await FetchPingRoleId(Context, GuildId);

    let Card;
    try {
        Card = await Channel.send({
            ...BuildDmModCard(DmMod, Interaction.user, { PingRoleId }),
            files: Image ? [{ attachment: Image.url, name: DmMod.ImageFileName }] : [],
        });
    } catch (SendError) {
        await DmModRepository.Delete(DmModId);
        Context.Logger.Error('Could not post /dmmod message to the mod thread', { GuildId, ChannelId: Channel.id, Error: SendError });
        await Interaction.editReply(BuildDmModResultView('Message Not Sent', 'Failed to send message to moderation team. Contact Habbo Staff.', { Success: false }));
        return;
    }
    await DmModRepository.SetMessageId(DmModId, Card.id);
    Context.Logger.Info('/dmmod message sent to the mod team', { DmModId, DiscordUserId: Interaction.user.id, GuildId });

    try {
        await Interaction.user.send(BuildDmModReceiptView(Interaction.user, Text, Guild.GuildType, Interaction.client.user?.displayAvatarURL?.()));
    } catch {
        await Interaction.editReply(
            BuildDmModResultView('Message Sent', "Your message has been sent to the moderation team, but I couldn't send you a confirmation DM. Please check your DM settings.", {
                Success: false,
            }),
        );
        return;
    }
    await Interaction.editReply(BuildDmModResultView('Message Sent', 'Your message has been sent to the moderation team and you should receive a confirmation DM shortly.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

async function FindOpenDmMod(Interaction, Context, DmModId) {
    const DmMod = await Context.Services.DmModRepository.FindById(DmModId);
    if (!DmMod || DmMod.GuildId !== Interaction.guildId) {
        await Interaction.reply(EphemeralView(BuildDmModResultView('Not Found', 'Could not find the original DMmod message.', { Success: false })));
        return null;
    }
    if (DmMod.Status !== 'OPEN') {
        await Interaction.reply(EphemeralView(BuildDmModResultView('Already Answered', `<@${DmMod.RepliedByDiscordUserId}> has already replied to this message.`, { Success: false })));
        return null;
    }
    return DmMod;
}

export async function HandleDmModReplyButton(Interaction, Context, { Arguments }) {
    const DmMod = await FindOpenDmMod(Interaction, Context, Arguments[0]);
    if (!DmMod) {
        return;
    }
    await Interaction.showModal(BuildDmModReplyModal(DmMod.DmModId, Interaction.user.id));
}

export async function HandleDmModReplyModal(Interaction, Context, { Arguments }) {
    const { DmModRepository } = Context.Services;
    const DmMod = await FindOpenDmMod(Interaction, Context, Arguments[0]);
    if (!DmMod) {
        return;
    }
    const ReplyText = Interaction.fields.getTextInputValue(DmModReplyInputId);
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!(await DmModRepository.ClaimReply(DmMod.DmModId, { RepliedByDiscordUserId: Interaction.user.id, ReplyText }))) {
        await Interaction.editReply(BuildDmModResultView('Already Answered', 'Another moderator has just replied to this message.', { Success: false }));
        return;
    }

    let Delivered = true;
    try {
        const Member = await Interaction.client.users.fetch(DmMod.DiscordUserId);
        await Member.send(BuildDmModReplyDmView(DmMod.DiscordUserId, ReplyText, DmMod.GuildType, DmMod.MessageText));
    } catch (DmError) {
        Delivered = false;
        Context.Logger.Warn('Could not DM a /dmmod reply', { DmModId: DmMod.DmModId, DiscordUserId: DmMod.DiscordUserId, Error: DmError });
    }
    await DmModRepository.SetReplyDelivered(DmMod.DmModId, Delivered);
    Context.Logger.Info('/dmmod reply recorded', { DmModId: DmMod.DmModId, StaffDiscordUserId: Interaction.user.id, DiscordUserId: DmMod.DiscordUserId, Delivered });

    try {
        const Replied = await DmModRepository.FindById(DmMod.DmModId);
        const [Channel, User, PingRoleId] = await Promise.all([
            FetchTextChannel(Interaction.client, Replied.ChannelId),
            Interaction.client.users.fetch(Replied.DiscordUserId),
            FetchPingRoleId(Context, Replied.GuildId),
        ]);
        const Card = await Channel.messages.fetch(Replied.MessageId);
        await Card.edit(BuildDmModCard(Replied, User, { PingRoleId }));
    } catch (EditError) {
        Context.Logger.Warn('Could not update the /dmmod card after replying', { DmModId: DmMod.DmModId, Error: EditError });
    }

    if (!Delivered) {
        await Interaction.editReply(BuildDmModResultView('Reply Not Delivered', `The message has been updated, but the reply was not sent. ${ReplyNotDeliveredNote}`, { Success: false }));
        return;
    }
    await Interaction.editReply(BuildDmModResultView('Reply Sent', 'Reply sent successfully and the message has been updated.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
