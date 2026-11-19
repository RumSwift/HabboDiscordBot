import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    escapeMarkdown,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    ThumbnailBuilder,
    time,
    TimestampStyles,
    userMention,
} from 'discord.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';
import { NoteScopes } from '../Repositories/ModNoteRepository.js';
import { SanctionTypes } from '../Repositories/ModSanctionRepository.js';
import { FormatCodeBlock } from '../Services/Logging/LogCard.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Games } from '../Utils/HotelConfiguration.js';

const PanelColour = 12745742;
export const ProfileColour = 0xff69b4;
const HammerIconUrl = 'https://icons.iconarchive.com/icons/google/noto-emoji-objects/1024/62953-hammer-icon.png';

export const ModPanelActions = Object.freeze({
    Button: 'ModPanelButton',
    Moderate: 'ModPanelModerate',
    ScamConfirm: 'ModPanelScamConfirm',
    ScamCancel: 'ModPanelScamCancel',
    DirectMessageForm: 'ModPanelDirectMessage',
    VerbalWarningForm: 'ModPanelVerbalWarning',
    CommunityRulesForm: 'ModPanelCommunityRules',
    AddNoteForm: 'ModPanelAddNote',
    ProfileForm: 'ModPanelProfile',
    RacismForm: 'ModPanelRacism',
    ForgiveConfirm: 'ModPanelForgiveConfirm',
    ForgiveCancel: 'ModPanelForgiveCancel',
    CustomType: 'ModPanelCustomType',
    CustomConfirm: 'ModPanelCustomConfirm',
    CustomCancel: 'ModPanelCustomCancel',
    CustomForm: 'ModPanelCustom',
});

export const ProfileReasonInputId = 'ProfileReason';

// Inappropriate Profile: the 1st violation in a server is a warning, the 2nd a kick, the 3rd (and after) a ban.
export const ProfileStages = Object.freeze([
    { Key: 'Warning', Punishment: '24 Hour Warning', Emoji: '💳' },
    { Key: 'Kick', Punishment: 'User Kicked', Emoji: '👢' },
    { Key: 'Ban', Punishment: 'User Banned', Emoji: '🚨' },
]);

export function ProfileStageFor(PreviousViolations) {
    return ProfileStages[Math.min(PreviousViolations, ProfileStages.length - 1)];
}

export const NoteInputs = Object.freeze({
    Title: 'NoteTitle',
    Text: 'NoteText',
    MessageLink: 'NoteMessageLink',
    Visibility: 'NoteVisibility',
});

export const NoteVisibility = Object.freeze({
    Global: 'Global',
    ThisServer: 'ThisServer',
});

const MinuteMs = 60 * 1000;
const HourMs = 60 * MinuteMs;
const DayMs = 24 * HourMs;

// Community Rules Violation: the Nth strike in a server gets StrikeTiers[N - 1]; every strike after the last mute is a ban.
export const StrikeTiers = Object.freeze([
    { Label: '10 Minutes', Ms: 10 * MinuteMs },
    { Label: '3 Hours', Ms: 3 * HourMs },
    { Label: '1 Day', Ms: DayMs },
    { Label: '5 Days', Ms: 5 * DayMs },
    { Label: '7 Days', Ms: 7 * DayMs },
    { Label: 'Ban', Ms: null },
]);

export function TierForStrike(PreviousStrikes) {
    return StrikeTiers[Math.min(PreviousStrikes, StrikeTiers.length - 1)];
}

// Racism: the 1st violation in a server is a 7 day mute, the 2nd (and after) a ban.
export const RacismTiers = Object.freeze([
    { Label: '7 Days', Ms: 7 * DayMs },
    { Label: 'Ban', Ms: null },
]);

export function TierForRacism(PreviousViolations) {
    return RacismTiers[Math.min(PreviousViolations, RacismTiers.length - 1)];
}

export const ReasonInputs = Object.freeze({
    PrivateReason: 'PrivateReason',
    PublicReason: 'PublicReason',
    MessageLink: 'MessageLink',
});

export const DirectMessageInputId = 'Message';
export const MaxDirectMessageLength = 2947;

// Buttons on the panel, by the key carried in their custom ID.
export const ModPanelButtons = Object.freeze({
    EmergencyMute: 'EmergencyMute',
    Scam: 'Scam',
    SendDm: 'SendDm',
    AddNote: 'AddNote',
    ViewNotes: 'ViewNotes',
});

export const ModerateOptions = Object.freeze({
    VerbalWarning: 'VerbalWarning',
    Sanction: 'Sanction',
    Profile: 'Profile',
    Racism: 'Racism',
    Forgive: 'Forgive',
    Custom: 'Custom',
});

export function ServerName(GuildType) {
    return GuildType === Games.Origins ? 'Habbo Hotel: Origins' : 'Habbo Hotel';
}

function Spacer(Size = SeparatorSpacingSize.Large) {
    return new SeparatorBuilder().setSpacing(Size).setDivider(false);
}

function Button(OwnerId, TargetId, Key, Label, Emoji, Style) {
    return new ButtonBuilder().setCustomId(BuildCustomId(ModPanelActions.Button, OwnerId, TargetId, Key)).setLabel(Label).setEmoji({ name: Emoji }).setStyle(Style);
}

const SanctionDisplay = Object.freeze({
    [SanctionTypes.EmergencyMute]: { Emoji: '🔕', Label: 'Emergency Mute' },
    [SanctionTypes.VerbalWarning]: { Emoji: '⚠️', Label: 'Verbal Warning' },
    [SanctionTypes.GuidelinesStrike]: { Emoji: '⚔️', Label: 'Guidelines Strike' },
    [SanctionTypes.InappropriateProfile]: { Emoji: '💳', Label: 'Inappropriate Profile' },
    [SanctionTypes.Racism]: { Emoji: '🤬', Label: 'Racism' },
    [SanctionTypes.Scam]: { Emoji: '🚨', Label: 'Scam/Phishing' },
    [SanctionTypes.Custom]: { Emoji: '🛠️', Label: 'Custom Sanction' },
});

export function SanctionLabel(SanctionType) {
    return SanctionDisplay[SanctionType] ?? { Emoji: '•', Label: SanctionType };
}

// Sanctions that mute the member (unless they were a ban).
const MutingSanctionTypes = new Set([SanctionTypes.EmergencyMute, SanctionTypes.GuidelinesStrike, SanctionTypes.Racism]);

export function SanctionMuted(Sanction) {
    // A custom sanction is a mute only when it says so (it can also be a kick or ban).
    if (Sanction.SanctionType === SanctionTypes.Custom) {
        return Boolean(Sanction.Punishment?.startsWith('Muted'));
    }
    return MutingSanctionTypes.has(Sanction.SanctionType) && Sanction.Punishment !== 'User Banned';
}

// What the member's next sanction of a tiered type will be, given how many of that type still count. Null for other types.
export function NextSanctionText(SanctionType, Counted) {
    if (SanctionType === SanctionTypes.GuidelinesStrike) {
        const Tier = TierForStrike(Counted);
        return `Community Rules strike #${Counted + 1}: ${Tier.Ms === null ? 'Ban' : `${Tier.Label} Mute`}`;
    }
    if (SanctionType === SanctionTypes.Racism) {
        const Tier = TierForRacism(Counted);
        return `Racism violation #${Counted + 1}: ${Tier.Ms === null ? 'Ban' : `${Tier.Label} Mute`}`;
    }
    if (SanctionType === SanctionTypes.InappropriateProfile) {
        return `Inappropriate Profile violation #${Counted + 1}: ${ProfileStageFor(Counted).Punishment}`;
    }
    return null;
}

const MaxHistoryShown = 10;

function FormatSanction(Sanction, Index) {
    const { Emoji, Label } = SanctionLabel(Sanction.SanctionType);
    const Name = Sanction.SanctionLink ? `[**${Label}**](${Sanction.SanctionLink})` : `**${Label}**`;
    return `${Index + 1}. ${Emoji} ${Name} | ${time(Sanction.CreatedTimestamp, TimestampStyles.RelativeTime)}`;
}

function CountOf(Sanctions, SanctionType) {
    return Sanctions.filter((Sanction) => Sanction.SanctionType === SanctionType).length;
}

// Sanctions is the member's mod history in this server, newest first.
export function BuildModPanelView(OwnerId, Target, GuildType, Sanctions = []) {
    const HistoryText = Sanctions.length > 0 ? Sanctions.slice(0, MaxHistoryShown).map(FormatSanction).join('\n') : '✅ No current mod history';
    const Counts = {
        Warnings: CountOf(Sanctions, SanctionTypes.VerbalWarning),
        Sanctions: CountOf(Sanctions, SanctionTypes.GuidelinesStrike),
        Profile: CountOf(Sanctions, SanctionTypes.InappropriateProfile),
        Racism: CountOf(Sanctions, SanctionTypes.Racism),
    };
    const AvatarUrl = Target.displayAvatarURL?.({ size: 128 });

    const Header = [
        new TextDisplayBuilder().setContent(`# ${GuildType === Games.Origins ? 'Habbo Hotel Origins' : 'Habbo Hotel'}: Modpanel`),
        new TextDisplayBuilder().setContent(`You're using the official Modpanel of the ${ServerName(GuildType)} Discord server. This information is private and should never be shared.`),
    ];
    const Container = new ContainerBuilder().setAccentColor(PanelColour);
    if (AvatarUrl) {
        Container.addSectionComponents(new SectionBuilder().setThumbnailAccessory(new ThumbnailBuilder().setURL(AvatarUrl)).addTextDisplayComponents(Header));
    } else {
        Container.addTextDisplayComponents(Header);
    }

    Container.addSeparatorComponents(Spacer())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Quick Actions'))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                Button(OwnerId, Target.id, ModPanelButtons.EmergencyMute, 'Emergency Mute (24 Hour)', '🔕', ButtonStyle.Danger),
                Button(OwnerId, Target.id, ModPanelButtons.Scam, 'Scam/Phishing (Ban)', '🐟', ButtonStyle.Danger),
                Button(OwnerId, Target.id, ModPanelButtons.SendDm, 'Send DM', '💬', ButtonStyle.Primary),
            ),
        )
        .addSeparatorComponents(Spacer())
        .addSectionComponents(
            new SectionBuilder()
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(HammerIconUrl))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## Moderate User'),
                    new TextDisplayBuilder().setContent('Here you can send Verbal Warnings, apply sanctions and more.'),
                ),
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(BuildCustomId(ModPanelActions.Moderate, OwnerId, Target.id))
                    .setPlaceholder('Choose an action')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Verbal Warning')
                            .setValue(ModerateOptions.VerbalWarning)
                            .setDescription('Sends the user an official Verbal Warning')
                            .setEmoji({ name: '⚠️' }),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Community Rules Violation')
                            .setValue(ModerateOptions.Sanction)
                            .setDescription('Apply Sanction: 10 Mins > 3 Hours > 1 Day > 5 Days > 7 Days > Ban')
                            .setEmoji({ name: '⚒️' }),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Inappropriate Profile')
                            .setValue(ModerateOptions.Profile)
                            .setDescription('24 Hour Warning > Kick > Ban')
                            .setEmoji({ name: '🃏' }),
                        new StringSelectMenuOptionBuilder().setLabel('Racism').setValue(ModerateOptions.Racism).setDescription('7 Day Mute > Ban').setEmoji({ name: '😡' }),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Custom Sanction')
                            .setValue(ModerateOptions.Custom)
                            .setDescription('Mute, kick or ban, outside the usual steps')
                            .setEmoji({ name: '🛠️' }),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Forgive Last Sanction')
                            .setValue(ModerateOptions.Forgive)
                            .setDescription('Removes their last sanction, and its mute, and steps them back one')
                            .setEmoji({ name: '🕊️' }),
                    ),
            ),
        )
        .addSeparatorComponents(Spacer(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## History of ${userMention(Target.id)}`),
            new TextDisplayBuilder().setContent(`**Mod history of ${userMention(Target.id)}:**\n\n${HistoryText}`),
        )
        .addSeparatorComponents(Spacer(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## History Numbers\n⚠️ **Warning Count**: ${Counts.Warnings}\n⚔️ **Sanction Count**: ${Counts.Sanctions}\n💳 **Inappropriate Profile**: ${Counts.Profile}\n🤬 **Racism**: ${Counts.Racism}`,
            ),
        )
        .addSeparatorComponents(Spacer(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('## User Notes'))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                Button(OwnerId, Target.id, ModPanelButtons.AddNote, 'Add Note', '📝', ButtonStyle.Secondary),
                Button(OwnerId, Target.id, ModPanelButtons.ViewNotes, 'View Notes', '📋', ButtonStyle.Secondary),
            ),
        );

    return { components: [Container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

// "Are you sure?" before a Scam/Phishing ban. OtherGuildType is null when the other server is not configured.
export function BuildScamConfirmView(OwnerId, Target, GuildType, OtherGuildType) {
    const Servers = OtherGuildType ? `the **${ServerName(GuildType)}** and **${ServerName(OtherGuildType)}** Discord servers` : `the **${ServerName(GuildType)}** Discord server`;
    const Embed = new EmbedBuilder()
        .setTitle('🚨 Scam/Phishing Ban Confirmation')
        .setDescription(
            `**Are you sure you want to ban ${userMention(Target.id)} (${escapeMarkdown(Target.username)}) for being a phishing bot or scammer?**\n\n` +
                `**This will:**\n• Permanently ban them from ${Servers}\n• Delete their messages from the last 7 days\n• Log the ban in Mod Actions and the ban log of each server\n\n-# User ID: ${Target.id}`,
        )
        .setColor(Colours.Danger);
    const AvatarUrl = Target.displayAvatarURL?.();
    if (AvatarUrl) {
        Embed.setThumbnail(AvatarUrl);
    }
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId(ModPanelActions.ScamConfirm, OwnerId, Target.id)).setLabel('Yes, Ban User').setEmoji({ name: '🚨' }).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(BuildCustomId(ModPanelActions.ScamCancel, OwnerId, Target.id)).setLabel('No, Cancel').setEmoji({ name: '❌' }).setStyle(ButtonStyle.Secondary),
    );
    return { ...View(Embed, [Row]), allowedMentions: { parse: [] } };
}

// "Are you sure?" before forgiving the member's last sanction. The buttons carry the sanction's ID, so a newer one is never forgiven by mistake.
export function BuildForgiveConfirmView(OwnerId, Target, Sanction) {
    const { Emoji, Label } = SanctionLabel(Sanction.SanctionType);
    const Name = Sanction.SanctionLink ? `[**${Label}**](${Sanction.SanctionLink})` : `**${Label}**`;
    const Punishment = Sanction.Punishment ? ` (${Sanction.Punishment})` : '';
    const Embed = new EmbedBuilder()
        .setTitle('🕊️ Forgive Last Sanction')
        .setDescription(
            [
                `**Are you sure you want to forgive the last sanction of ${userMention(Target.id)} (${escapeMarkdown(Target.username)})?**`,
                '',
                `${Emoji} ${Name}${Punishment} | ${time(new Date(Sanction.CreatedTimestamp), TimestampStyles.RelativeTime)}`,
                '',
                '**This will:**',
                '• Remove it from their record, so their next sanction of this type steps back one',
                '• Remove their mute, if this sanction muted them',
                '• Send them a DM apologising and explaining what was done',
            ].join('\n'),
        )
        .setColor(Colours.Success);
    const AvatarUrl = Target.displayAvatarURL?.();
    if (AvatarUrl) {
        Embed.setThumbnail(AvatarUrl);
    }
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BuildCustomId(ModPanelActions.ForgiveConfirm, OwnerId, Target.id, String(Sanction.SanctionId)))
            .setLabel('Yes, Forgive')
            .setEmoji({ name: '🕊️' })
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(BuildCustomId(ModPanelActions.ForgiveCancel, OwnerId, Target.id)).setLabel('No, Cancel').setEmoji({ name: '❌' }).setStyle(ButtonStyle.Secondary),
    );
    return { ...View(Embed, [Row]), allowedMentions: { parse: [] } };
}

// The apology a forgiven member receives. MuteRemoved is true when their mute was lifted.
export function BuildForgiveDmView(UserId, GuildType, MuteRemoved) {
    const Done = ['• The sanction has been removed from your record.'];
    if (MuteRemoved) {
        Done.unshift('• Your mute has been removed.');
    }
    const Embed = new EmbedBuilder()
        .setTitle(`Formal Message from __${ServerName(GuildType)} Server__`)
        .setDescription(
            [
                `Hello ${userMention(UserId)},`,
                '',
                'After reviewing your most recent sanction, the moderation team has decided to **forgive** it. We are sorry for any inconvenience this may have caused.',
                '',
                '**What we have done:**',
                ...Done,
                '',
                'If you have any questions, you can use **/dmmod** in any channel, or reply to this DM to start a conversation with the moderation team.',
                '',
                'Thank you for understanding.',
            ].join('\n'),
        )
        .setColor(Colours.Success)
        .setFooter({ text: `${ServerName(GuildType)} Moderation Team` });
    return View(Embed);
}

export function BuildDirectMessageModal(OwnerId, TargetId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(ModPanelActions.DirectMessageForm, OwnerId, TargetId))
        .setTitle('Write your DM')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(DirectMessageInputId)
                    .setLabel('WHAT IS YOUR MESSAGE?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Message to send the user via DM')
                    .setRequired(true)
                    .setMaxLength(MaxDirectMessageLength),
            ),
        );
}

export function TextInputRow(Id, Label, Style, Placeholder, MaxLength, Required = true) {
    return new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(Id).setLabel(Label).setStyle(Style).setPlaceholder(Placeholder).setRequired(Required).setMaxLength(MaxLength),
    );
}

// Internal reason, public reason and a message link (Verbal Warning, Community Rules Violation, Racism).
// The link to the message or logs is always optional.
function BuildReasonsModal(Action, Title, OwnerId, TargetId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(Action, OwnerId, TargetId))
        .setTitle(Title)
        .addComponents(
            TextInputRow(ReasonInputs.PrivateReason, 'INTERNAL REASON', TextInputStyle.Paragraph, 'Explanation for the moderation team. Only shared in Mod Actions.', 800),
            TextInputRow(ReasonInputs.PublicReason, 'PUBLIC REASON', TextInputStyle.Paragraph, 'Reason sent to the user. Keep it short, one paragraph at most.', 500),
            TextInputRow(ReasonInputs.MessageLink, 'MESSAGE LINK (OPTIONAL)', TextInputStyle.Short, 'Link to the message(s) or logs as proof. If deleted, use the link from the logs.', 500, false),
        );
}

export function BuildVerbalWarningModal(OwnerId, TargetId) {
    return BuildReasonsModal(ModPanelActions.VerbalWarningForm, 'Verbal Warning', OwnerId, TargetId);
}

export function BuildCommunityRulesModal(OwnerId, TargetId) {
    return BuildReasonsModal(ModPanelActions.CommunityRulesForm, 'Community Rules Violation', OwnerId, TargetId);
}

export function BuildRacismModal(OwnerId, TargetId) {
    return BuildReasonsModal(ModPanelActions.RacismForm, 'Racism Violation', OwnerId, TargetId);
}

export function BuildProfileModal(OwnerId, TargetId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(ModPanelActions.ProfileForm, OwnerId, TargetId))
        .setTitle('Inappropriate Profile Action')
        .addComponents(
            TextInputRow(
                ProfileReasonInputId,
                'PROFILE VIOLATION DETAILS',
                TextInputStyle.Paragraph,
                'Describe what about their profile is inappropriate (avatar, banner, status, etc.)',
                800,
            ),
        );
}

function NoteTextInput(Id, Style, Placeholder, MaxLength, Required = true) {
    return new TextInputBuilder().setCustomId(Id).setStyle(Style).setPlaceholder(Placeholder).setRequired(Required).setMaxLength(MaxLength);
}

// 📝 Add Note: title, note, optional link, and where it is visible (global unless changed).
export function BuildAddNoteModal(OwnerId, TargetId) {
    return new ModalBuilder()
        .setCustomId(BuildCustomId(ModPanelActions.AddNoteForm, OwnerId, TargetId))
        .setTitle('Add User Note')
        .addLabelComponents(
            new LabelBuilder().setLabel('NOTE TITLE').setTextInputComponent(NoteTextInput(NoteInputs.Title, TextInputStyle.Short, 'Brief title for this note...', 100)),
            new LabelBuilder().setLabel('NOTE TEXT').setTextInputComponent(NoteTextInput(NoteInputs.Text, TextInputStyle.Paragraph, 'Enter your note about this user...', 1000)),
            new LabelBuilder()
                .setLabel('MESSAGE LINK (OPTIONAL)')
                .setTextInputComponent(NoteTextInput(NoteInputs.MessageLink, TextInputStyle.Short, 'Link to relevant message (optional)', 500, false)),
            new LabelBuilder()
                .setLabel('VISIBILITY')
                .setDescription('Global notes are shared with every server. Who added it is only shown here.')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId(NoteInputs.Visibility)
                        .setRequired(true)
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Global')
                                .setValue(NoteVisibility.Global)
                                .setDescription('Added to the user in both servers')
                                .setEmoji({ name: '🌍' })
                                .setDefault(true),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('This server only')
                                .setValue(NoteVisibility.ThisServer)
                                .setDescription('Only visible in this server')
                                .setEmoji({ name: '🔒' }),
                        ),
                ),
        );
}

// A formal DM about a sanction: Kind is shown underlined and bold, Outcome (e.g. the mute) goes under the reason.
const DefaultDmClosing = 'Unfortunately, if this continues, we will have to take further action. We encourage you to read our community guidelines.';

export function BuildSanctionDmView(UserId, GuildType, Kind, PublicReason, Outcome = null, Closing = DefaultDmClosing) {
    const Embed = new EmbedBuilder()
        .setTitle(`Formal Message from __${ServerName(GuildType)} Server__`)
        .setDescription(
            `Hello ${userMention(UserId)},\n\nThis is a **__${Kind}__** regarding your recent behaviour in the Discord.\n\n${FormatCodeBlock(PublicReason, 500)}\n` +
                (Outcome ? `${Outcome}\n\n` : '') +
                `${Closing}\n\n` +
                'If you have any questions or require clarification, you can use **/dmmod** in any channel for assistance. Alternatively, feel free to reply to this DM to start a conversation with the moderation team.\n\nThank you for understanding.',
        )
        .setColor(16620576)
        .setFooter({ text: `${ServerName(GuildType)} Moderation Team` });
    return View(Embed);
}

// The DM a warned member receives.
export function BuildVerbalWarningDmView(UserId, GuildType, PublicReason) {
    return BuildSanctionDmView(UserId, GuildType, 'verbal warning', PublicReason);
}

// The DM a member receives for a community rules strike. Tier.Ms is null for the ban.
export function BuildCommunityRulesDmView(UserId, GuildType, PublicReason, Tier) {
    const Outcome = Tier.Ms === null ? '**You have been banned from the server.**' : `**You have been muted for ${Tier.Label.toLowerCase()}.**`;
    return BuildSanctionDmView(UserId, GuildType, 'community guidelines strike', PublicReason, Outcome);
}

// The DM a member receives for a racism violation. Tier.Ms is null for the ban.
export function BuildRacismDmView(UserId, GuildType, PublicReason, Tier) {
    const Outcome = Tier.Ms === null ? '**You have been banned from the server.**' : `**You have been muted for ${Tier.Label.toLowerCase()}.**`;
    return BuildSanctionDmView(UserId, GuildType, 'racism violation', PublicReason, Outcome, 'Racism and discriminatory behaviour have zero tolerance in our community. We encourage you to read our community guidelines.');
}

// The DM a member receives for an inappropriate profile, by stage (see ProfileStages).
export function BuildProfileDmView(UserId, GuildType, Reason, Stage) {
    const Server = ServerName(GuildType);
    const Details = FormatCodeBlock(Reason, 800);
    // Each body is a list of paragraphs.
    const Messages = {
        Warning: {
            Title: `Profile Violation Warning - ${Server}`,
            Body: [
                'This is an **official warning** regarding your current profile on our Discord server.',
                '**Issue:** Your profile contains inappropriate content that violates our community guidelines.',
                `**Details:**\n${Details}`,
                '**Required Action:** You have **24 hours** to update your profile (avatar, banner, status, etc.) to comply with our community standards.',
                '**Next Steps:** If your profile is not updated within 24 hours, further moderation actions will be taken, including removal from the server.',
                'If you have any questions, please use **/dmmod** for assistance.',
            ],
        },
        Kick: {
            Title: 'Profile Violation - Removed from Server',
            Body: [
                `You have been **removed from the ${Server} Discord server** due to an inappropriate profile violation.`,
                '**Previous Warning:** We previously gave you 24 hours to update your inappropriate profile content.',
                '**Current Issue:** Your profile still contains inappropriate content that violates our community guidelines.',
                `**Details:**\n${Details}`,
                '**Important:** If you choose to rejoin our server, you **must** have an appropriate profile. Rejoining with an inappropriate profile will result in an immediate and permanent ban.',
                'Please ensure your profile (avatar, banner, status, etc.) complies with our community standards before rejoining.',
            ],
        },
        Ban: {
            Title: 'Permanent Ban - Profile Violations',
            Body: [
                `You have been **permanently banned** from the ${Server} Discord server due to repeated inappropriate profile violations.`,
                '**Violation History:**\n• First offense: 24-hour warning to change inappropriate profile\n• Second offense: Removal from the server with a warning about rejoining\n• Current offense: Continued inappropriate profile content',
                `**Current Issue:**\n${Details}`,
                '**Final Decision:** Due to multiple chances given to comply with our community standards, this ban is permanent.',
            ],
        },
    };
    const { Title, Body } = Messages[Stage.Key];
    const Embed = new EmbedBuilder()
        .setTitle(Title)
        .setDescription(`Hello ${userMention(UserId)},\n\n${Body.join('\n\n')}\n\nThank you for your understanding.`)
        .setColor(ProfileColour)
        .setFooter({ text: `${Server} Moderation Team` });
    return View(Embed);
}

// The DM the member receives.
export function BuildDirectMessageDmView(UserId, GuildType, MessageText) {
    const Embed = new EmbedBuilder()
        .setTitle(`Formal Message from **${ServerName(GuildType)} Server**`)
        .setDescription(
            `Hello ${userMention(UserId)},\n\n${MessageText}\n\n` +
                'If you have any questions or require clarification, you can use **/dmmod** in any channel for assistance. Alternatively, feel free to reply to this message to start a conversation with the moderation team.\n\nThank you for understanding.',
        )
        .setColor(16620576)
        .setFooter({ text: `${ServerName(GuildType)} Moderation Team` });
    return View(Embed);
}

export const MaxNotesShown = 25;
const MaxNotesListLength = 3800;

// Square brackets would break the [title](link) markdown.
function NoteTitleText(Title) {
    return escapeMarkdown(Title).replace(/[[\]]/g, (Bracket) => `\\${Bracket}`);
}

// 📋 View Notes: every note this server can see, newest first. Each links to this server's copy of its log,
// and says where it was added when that was another server. Notes come from ModNoteRepository.GetVisibleNotes.
export function BuildViewNotesView(Target, GuildId, Notes) {
    const Embed = new EmbedBuilder().setColor(0x98fb98).setTimestamp();
    const AvatarUrl = Target.displayAvatarURL?.();
    if (AvatarUrl) {
        Embed.setThumbnail(AvatarUrl);
    }
    if (Notes.length === 0) {
        return View(Embed.setTitle('📋 No Notes Found').setDescription(`No notes found for ${userMention(Target.id)} (${escapeMarkdown(Target.username)}).`));
    }
    // Stops early if the list would not fit in one embed.
    const Lines = [];
    let Length = 0;
    for (const Note of Notes.slice(0, MaxNotesShown)) {
        const Icon = Note.Scope === NoteScopes.Server ? '🔒' : '🌍';
        const Title = NoteTitleText(Note.Title);
        const Name = Note.LogLink ? `[**${Title}**](${Note.LogLink})` : `**${Title}**`;
        const Origin = Note.OriginGuildId === GuildId ? '' : ` | from ${ServerName(Note.OriginGuildType)}`;
        const Line = `${Icon} ${Name} | ${time(new Date(Note.CreatedTimestamp), TimestampStyles.RelativeTime)}${Origin}`;
        if (Length + Line.length + 1 > MaxNotesListLength) {
            break;
        }
        Lines.push(Line);
        Length += Line.length + 1;
    }
    Embed.setTitle(`📋 Viewing Notes of ${escapeMarkdown(Target.username)}`).setDescription(
        [`**Total Notes:** ${Notes.length}`, '-# 🌍 Global note | 🔒 This server only', '', ...Lines].join('\n'),
    );
    if (Lines.length < Notes.length) {
        Embed.setFooter({ text: `Showing the newest ${Lines.length} of ${Notes.length} notes.` });
    }
    return View(Embed);
}

// Successes self-destruct, problems stay so they can be read.
export function BuildModPanelResultView(Title, Description, { Success = true, Colour = null } = {}) {
    const Embed = new EmbedBuilder()
        .setTitle(Title)
        .setDescription(Description)
        .setColor(Colour ?? (Success ? Colours.Success : Colours.Danger));
    if (Success) {
        Embed.setFooter({ text: SelfDestructNote });
    }
    return View(Embed);
}
