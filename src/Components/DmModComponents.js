import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ModalBuilder,
    roleMention,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    userMention,
} from 'discord.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';
import { BuildLogCard, FormatCodeBlock } from '../Services/Logging/LogCard.js';
import { AnyUser, BuildCustomId } from '../Utils/CustomId.js';
import { Games } from '../Utils/HotelConfiguration.js';

export const DmModReplyAction = 'DmModReply';
export const DmModReplyModalAction = 'DmModReplyModal';
export const DmModReplyInputId = 'ReplyText';
export const MaxDmModTextLength = 1500;
export const MaxDmModReplyLength = 1500;
export const ReplyNotDeliveredNote = 'User may have DMs off so did not receive this reply.';

const Purple = 0x800080;

function ServerTitle(GuildType) {
    return GuildType === Games.Origins ? 'Habbo Hotel: Origins Server' : 'Habbo Hotel Server';
}

function ModerationTeamName(GuildType) {
    return GuildType === Games.Origins ? 'Habbo Hotel: Origins Moderation' : 'Habbo Hotel Moderation';
}

export function BuildDmModCard(DmMod, User, { PingRoleId = null, Now = DmMod.CreatedTimestamp } = {}) {
    const IsOpen = DmMod.Status === 'OPEN';
    const Card = BuildLogCard({
        Title: '💬 New message for the Mod team',
        User,
        Colour: IsOpen ? Purple : Colours.Success,
        Fields: [
            { Label: 'Reported player', Value: DmMod.ReportedDiscordUserId ? userMention(DmMod.ReportedDiscordUserId) : 'None' },
            { Label: 'Reported message', Value: DmMod.ReportedMessage || 'None' },
            { Label: 'Message', Value: FormatCodeBlock(DmMod.MessageText, MaxDmModTextLength) },
        ],
        AddExtras: (Container) => {
            if (DmMod.ImageFileName) {
                Container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${DmMod.ImageFileName}`)));
            }
            if (!IsOpen) {
                Container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
                Container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Replied By:** ${userMention(DmMod.RepliedByDiscordUserId)}\n${FormatCodeBlock(DmMod.ReplyText ?? '', MaxDmModReplyLength)}`),
                );
                if (Number(DmMod.ReplyDelivered) === 0) {
                    Container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${ReplyNotDeliveredNote}`));
                }
            }
        },
        FooterNotes: IsOpen ? ['React to this msg with a ✅ if you are taking care of this message.'] : [],
        Now,
    });

    if (IsOpen) {
        Card.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(BuildCustomId(DmModReplyAction, AnyUser, DmMod.DmModId)).setLabel('Reply').setEmoji('💬').setStyle(ButtonStyle.Primary),
            ),
        );
    }

    const Components = PingRoleId ? [new TextDisplayBuilder().setContent(roleMention(PingRoleId)), Card] : [Card];
    return {
        components: Components,
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [], roles: PingRoleId ? [PingRoleId] : [] },
    };
}

export function BuildDmModReceiptView(User, Text, GuildType, BotAvatarUrl) {
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle(`Formal message from ${ServerTitle(GuildType)}`)
        .setDescription(
            `Thank you again, ${User}!\n\nYour message has been received and will be reviewed promptly. Should we require further information or need to get in touch, we'll do it here.\n\nMeanwhile, this is a preview of your message:`,
        )
        .addFields({ name: 'Your message', value: FormatCodeBlock(Text, MaxDmModTextLength) })
        .setFooter({ text: 'Have a nice day!' });
    if (BotAvatarUrl) {
        Embed.setThumbnail(BotAvatarUrl);
    }
    return View(Embed);
}

export function BuildDmModReplyDmView(UserId, ReplyText, GuildType, OriginalText) {
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle(`Formal message from ${ServerTitle(GuildType)}`)
        .setDescription(`Hello ${userMention(UserId)},\n\n${ReplyText}\n\nIf you have any questions, you can use /dmmod in any channel for quick help.`)
        .addFields({ name: 'Your original message', value: FormatCodeBlock(OriginalText, MaxDmModTextLength) })
        .setFooter({ text: ModerationTeamName(GuildType) });
    return View(Embed);
}

export function BuildDmModReplyModal(DmModId, OwnerDiscordUserId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(DmModReplyModalAction, OwnerDiscordUserId, DmModId))
        .setTitle('Write your DM')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId(DmModReplyInputId).setLabel('Reply').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(MaxDmModReplyLength),
            ),
        );
}

export function BuildDmModResultView(Title, Description, { Success = true } = {}) {
    const Embed = new EmbedBuilder()
        .setTitle(Title)
        .setDescription(Description)
        .setColor(Success ? Colours.Success : Colours.Danger);
    if (Success) {
        Embed.setFooter({ text: SelfDestructNote });
    }
    return View(Embed);
}
