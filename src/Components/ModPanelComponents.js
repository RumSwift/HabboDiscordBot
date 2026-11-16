import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    time,
    TimestampStyles,
    userMention,
} from 'discord.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';
import { SanctionTypes } from '../Repositories/ModSanctionRepository.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Games } from '../Utils/HotelConfiguration.js';

const PanelColour = 12745742;
const HammerIconUrl = 'https://icons.iconarchive.com/icons/google/noto-emoji-objects/1024/62953-hammer-icon.png';

export const ModPanelActions = Object.freeze({
    Button: 'ModPanelButton',
    Moderate: 'ModPanelModerate',
});

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
});

function ServerName(GuildType) {
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
});

const MaxHistoryShown = 10;

function FormatSanction(Sanction, Index) {
    const { Emoji, Label } = SanctionDisplay[Sanction.SanctionType] ?? { Emoji: '•', Label: Sanction.SanctionType };
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
                            .setDescription('Apply Sanction: 10 Mins > 3 Hour > 1 Day > 5 Days > Ban')
                            .setEmoji({ name: '⚒️' }),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Inappropriate Profile')
                            .setValue(ModerateOptions.Profile)
                            .setDescription('Verbal Warning > Kick after 24 Hours > Ban on Return')
                            .setEmoji({ name: '🃏' }),
                        new StringSelectMenuOptionBuilder().setLabel('Racism').setValue(ModerateOptions.Racism).setDescription('7 Day Mute > Ban').setEmoji({ name: '😡' }),
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
