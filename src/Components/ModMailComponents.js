import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    FileBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ModalBuilder,
    roleMention,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    userMention,
} from 'discord.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';
import { BuildLogCard, FormatCodeBlock } from '../Services/Logging/LogCard.js';
import { AnyUser, BuildCustomId } from '../Utils/CustomId.js';
import { Games } from '../Utils/HotelConfiguration.js';

export const ModMailActions = Object.freeze({
    Open: 'ModMailOpen',
    Team: 'ModMailTeam',
    Form: 'ModMailForm',
    Close: 'ModMailClose',
    ConfirmClose: 'ModMailConfirmClose',
    Pass: 'ModMailPass',
    ConfirmPass: 'ModMailConfirmPass',
    Cancel: 'ModMailCancel',
});
export const ModMailTitleInputId = 'MailTitle';
export const ModMailInquiryInputId = 'MailInquiry';
export const MaxModMailTitleLength = 100;
export const MaxModMailInquiryLength = 3000;
export const ReplyNotDeliveredNote = 'User may have DMs off so did not receive this reply.';

const Purple = 0x800080;
const Gold = 0xffd700;

export function TeamName(GuildType) {
    return GuildType === Games.Origins ? 'Habbo Origins Team' : 'Habbo Team';
}

function ModerationTeamFooter(GuildType) {
    return GuildType === Games.Origins ? 'Habbo Hotel: Origins Moderation Team' : 'Habbo Hotel Moderation Team';
}

// Sent when a member DMs the bot without an open mod mail.
export function BuildOpenModMailPromptView(User, BotAvatarUrl) {
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle('📧 Open Mod Mail')
        .setDescription(
            `Hello ${User}!\n\nIt looks like you have something you'd like to discuss with our moderation team. Would you like to open a Mod Mail to get assistance?\n\n` +
                'Please keep in mind:\n\n' +
                '• For **in-game support or technical issues**, please contact the Help Center directly. They are best equipped to assist with game-related matters.\n' +
                '• Habbo: https://help.habbo.com\n' +
                '• Habbo Origins: https://habbohotelorigins.zendesk.com\n' +
                '• We will **never ask for personal information** through Mod Mail. Your privacy and security are our top priorities.\n' +
                '• You can also use the **/dmmod command** for quick queries or concerns.\n\n' +
                "If you wish to proceed with opening a Mod Mail, let us know, and we'll set it up for you!\n\nThank you!\n\nClick the button below to open a ticket!",
        );
    if (BotAvatarUrl) {
        Embed.setThumbnail(BotAvatarUrl);
    }
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId(ModMailActions.Open, User.id)).setLabel('Open Mod Mail').setEmoji('📧').setStyle(ButtonStyle.Danger),
    );
    return View(Embed, [Row]);
}

// Teams: [{ GuildId, GuildType }] for every server with a mod mail forum.
export function BuildTeamSelectView(OwnerDiscordUserId, Teams) {
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle('🛡️ Team Selection')
        .setDescription("Okay, let's connect you to the correct team!\n\nWhich moderation team would you like to contact? You can only have one mod mail open at a time.\n\nChoose your team below:");
    const Row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(BuildCustomId(ModMailActions.Team, OwnerDiscordUserId))
            .setPlaceholder('Select the team to contact')
            .addOptions(
                Teams.map((Team) => ({
                    label: TeamName(Team.GuildType),
                    description: Team.GuildType === Games.Origins ? 'The Habbo Origins Discord moderators' : 'The Habbo Discord moderators',
                    value: Team.GuildId,
                })),
            ),
    );
    return View(Embed, [Row]);
}

// Sent instead of the prompt when the member is banned from contacting every team.
export function BuildModMailRestrictedView(User, BotAvatarUrl) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Danger)
        .setTitle('🚫 ModMail Access Restricted')
        .setDescription(
            `Hello ${User},\n\nYour access to ModMail has been restricted by the moderation team. You are currently unable to contact our moderators through this system.\n\n` +
                'If you believe this restriction was applied in error, please contact our support team through alternative channels:\n\n' +
                '• Habbo: https://help.habbo.com\n' +
                '• Habbo Origins: https://habbohotelorigins.zendesk.com\n\nThank you for understanding.',
        )
        .setFooter({ text: 'Habbo Hotel Moderation Team' });
    if (BotAvatarUrl) {
        Embed.setThumbnail(BotAvatarUrl);
    }
    return View(Embed);
}

export function BuildTeamRestrictedView(GuildType) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Danger)
        .setTitle('🚫 ModMail Access Restricted')
        .setDescription(`Your access to ModMail with the **${TeamName(GuildType)}** has been restricted by their moderation team.`);
    return View(Embed);
}

export function BuildAlreadyOpenView(GuildType) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Warning)
        .setTitle('Mod Mail Already Open')
        .setDescription(`You already have an open mod mail with the **${TeamName(GuildType)}**. Send a message here to add to it.\n\nYou can only contact one team at a time.`);
    return View(Embed);
}

export function BuildModMailUnavailableView() {
    const Embed = new EmbedBuilder().setColor(Colours.Danger).setTitle('Mod Mail Unavailable').setDescription('There was an error creating your mod mail. Please try again later or contact Habbo Staff.');
    return View(Embed);
}

export function BuildModMailModal(OwnerDiscordUserId, GuildId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(ModMailActions.Form, OwnerDiscordUserId, GuildId))
        .setTitle('Modmail')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(ModMailTitleInputId)
                    .setLabel('Give Your Request A Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. "Reporting a user"')
                    .setRequired(true)
                    .setMaxLength(MaxModMailTitleLength),
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(ModMailInquiryInputId)
                    .setLabel('What Is Your Inquiry?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Explain your issue/request detailed enough for us to help')
                    .setRequired(true)
                    .setMaxLength(MaxModMailInquiryLength),
            ),
        );
}

export function BuildModMailOpenedView(ModMail, BotAvatarUrl) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Success)
        .setTitle('✅ Mod Mail Opened Successfully!')
        .setDescription(
            `Thank you for contacting our moderation team!\n\nYour mod mail has been created and sent to the **${TeamName(ModMail.GuildType)}**. A moderator will review your request and respond as soon as possible.\n\n` +
                `Here's a copy of what you submitted:\n\n**Title:** ${ModMail.Title}\n\n**Your Inquiry:**\n${FormatCodeBlock(ModMail.Inquiry, 3000)}\n\nThank you for your patience!`,
        )
        .setFooter({ text: ModerationTeamFooter(ModMail.GuildType) });
    if (BotAvatarUrl) {
        Embed.setThumbnail(BotAvatarUrl);
    }
    return View(Embed);
}

// The first message of the forum thread. OtherTeamGuildType is set while the mail can still be passed on.
export function BuildModMailThreadCard(ModMail, User, { PingRoleId = null, PassedFromGuildType = null, OtherTeamGuildType = null } = {}) {
    const IsOpen = ModMail.Status === 'OPEN';
    const Fields = [
        { Label: 'Title:', Value: `"${ModMail.Title}"` },
        { Label: 'Opener:', Value: `${userMention(ModMail.DiscordUserId)} (${ModMail.DiscordUserId})` },
        { Label: 'Message:', Value: FormatCodeBlock(ModMail.Inquiry, 3000) },
    ];
    if (PassedFromGuildType) {
        Fields.unshift({ Label: 'Passed over', Value: `This mod mail was passed to you by the **${TeamName(PassedFromGuildType)}**.` });
    }

    const Buttons = [];
    if (IsOpen) {
        Buttons.push(new ButtonBuilder().setCustomId(BuildCustomId(ModMailActions.Close, AnyUser, ModMail.ModMailId)).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger));
        if (OtherTeamGuildType && !ModMail.FirstModReplyTimestamp) {
            Buttons.push(
                new ButtonBuilder()
                    .setCustomId(BuildCustomId(ModMailActions.Pass, AnyUser, ModMail.ModMailId))
                    .setLabel(`Pass to ${TeamName(OtherTeamGuildType)}`)
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary),
            );
        }
    }

    const Card = BuildLogCard({
        Title: `📧 Mod Mail By ${User.username}`,
        User,
        Colour: IsOpen ? Gold : Colours.Neutral,
        Fields,
        FooterNotes: [IsOpen ? 'Send a message to reply!' : `Mod mail ${ModMail.Status === 'PASSED' ? 'passed to the other team' : 'closed'}`],
        Buttons,
        Now: ModMail.CreatedTimestamp,
    });
    const Components = PingRoleId ? [new TextDisplayBuilder().setContent(roleMention(PingRoleId)), Card] : [Card];
    return { components: Components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [], roles: PingRoleId ? [PingRoleId] : [] } };
}

// A moderator's message, sent to the member without the moderator's name.
// Files: [{ FileName, IsMedia, IsSpoiler }] uploaded with the message (see SaveAttachments).
export function BuildModReplyDmView(Content, GuildType, Files = []) {
    const Quoted = Content
        ? Content.split('\n')
              .map((Line) => `> ${Line}`)
              .join('\n')
        : '*The moderation team sent you an attachment.*';
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle('💬 Reply from Moderation Team')
        .setDescription(`You have received a reply to your mod mail:\n\n${Quoted}`)
        .setFooter({ text: ModerationTeamFooter(GuildType) });
    const Result = View(Embed);
    AddFileComponents(Result.components[0], Files);
    return Result;
}

// Components V2 messages only show files that a component points at.
export function AddFileComponents(Container, Files) {
    const Media = Files.filter((File) => File.IsMedia);
    const Others = Files.filter((File) => !File.IsMedia);
    if (Media.length > 0) {
        Container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(Media.map((File) => new MediaGalleryItemBuilder().setURL(`attachment://${File.FileName}`).setSpoiler(File.IsSpoiler))),
        );
    }
    if (Others.length > 0) {
        Container.addFileComponents(Others.map((File) => new FileBuilder().setURL(`attachment://${File.FileName}`).setSpoiler(File.IsSpoiler)));
    }
}

export function FormatNotForwarded(Files) {
    return Files.map((File) => `• ${File.Name} (${File.Problem})`).join('\n');
}

export function BuildModMailClosedDmView(GuildType) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Danger)
        .setTitle('🔒 Mod Mail Closed')
        .setDescription('Your mod mail has been closed by the moderation team. If you need further assistance, feel free to send another message to open a new mod mail.')
        .setFooter({ text: ModerationTeamFooter(GuildType) });
    return View(Embed);
}

export function BuildModMailPassedDmView(ToGuildType) {
    const Embed = new EmbedBuilder()
        .setColor(Purple)
        .setTitle('➡️ Mod Mail Passed On')
        .setDescription(`Your mod mail has been passed to the **${TeamName(ToGuildType)}**, who are best placed to help. You don't need to do anything; keep replying here as usual.`)
        .setFooter({ text: ModerationTeamFooter(ToGuildType) });
    return View(Embed);
}

export function BuildModMailConfirmView(Description, ConfirmCustomId, CancelCustomId) {
    const Embed = new EmbedBuilder().setColor(Colours.Danger).setDescription(Description).setTitle('Are You Sure?');
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(ConfirmCustomId).setLabel('Yes').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(CancelCustomId).setLabel('No').setStyle(ButtonStyle.Secondary),
    );
    return View(Embed, [Row]);
}

// Moderator confirmations: successes self-destruct, problems stay so they can be read.
export function BuildModMailResultView(Title, Description, { Success = true } = {}) {
    const Embed = new EmbedBuilder()
        .setTitle(Title)
        .setDescription(Description)
        .setColor(Success ? Colours.Success : Colours.Danger);
    if (Success) {
        Embed.setFooter({ text: SelfDestructNote });
    }
    return View(Embed);
}
