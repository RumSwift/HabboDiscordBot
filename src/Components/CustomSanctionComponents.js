import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    escapeMarkdown,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputStyle,
    userMention,
} from 'discord.js';
import { Colours, View } from './ComponentStyles.js';
import { BuildSanctionDmView, ModPanelActions, ReasonInputs, TextInputRow } from './ModPanelComponents.js';
import { BuildCustomId } from '../Utils/CustomId.js';

export const CustomSanctionColour = 0x9b59b6;

export const CustomSanctionKinds = Object.freeze({
    Mute: 'Mute',
    Kick: 'Kick',
    Ban: 'Ban',
});

export const DurationInputId = 'Duration';

const MinuteMs = 60 * 1000;
const UnitMs = Object.freeze({ m: MinuteMs, h: 60 * MinuteMs, d: 24 * 60 * MinuteMs });
const UnitNames = Object.freeze({ d: ['Day', 'Days'], h: ['Hour', 'Hours'], m: ['Minute', 'Minutes'] });
// Discord's longest timeout.
export const MaxMuteMs = 28 * UnitMs.d;

// "5m", "3h", "2d" or combinations such as "1d12h" or "1h 30m". Returns { Ms, Label } (e.g. "1 Day 12 Hours"),
// or null when it cannot be read or is not between 1 minute and 28 days.
export function ParseMuteDuration(Text) {
    const Compact = String(Text ?? '').toLowerCase().replace(/\s+/g, '');
    if (!/^(\d+[mhd])+$/.test(Compact)) {
        return null;
    }
    const Totals = { d: 0, h: 0, m: 0 };
    for (const [, Amount, Unit] of Compact.matchAll(/(\d+)([mhd])/g)) {
        Totals[Unit] += Number(Amount);
    }
    const Ms = Totals.d * UnitMs.d + Totals.h * UnitMs.h + Totals.m * UnitMs.m;
    if (Ms < MinuteMs || Ms > MaxMuteMs) {
        return null;
    }
    const Label = ['d', 'h', 'm']
        .filter((Unit) => Totals[Unit] > 0)
        .map((Unit) => `${Totals[Unit]} ${UnitNames[Unit][Totals[Unit] === 1 ? 0 : 1]}`)
        .join(' ');
    return { Ms, Label };
}

// What is recorded and shown, e.g. "Muted for 2 Days", "User Kicked", "User Banned".
export function CustomPunishment(Kind, Duration = null) {
    if (Kind === CustomSanctionKinds.Mute) {
        return `Muted for ${Duration.Label}`;
    }
    return Kind === CustomSanctionKinds.Kick ? 'User Kicked' : 'User Banned';
}

// 🛠️ Custom Sanction: choose mute, kick or ban.
export function BuildCustomTypeView(OwnerId, Target) {
    const Embed = new EmbedBuilder()
        .setTitle('🛠️ Custom Sanction')
        .setDescription(
            [
                `Choose the sanction for ${userMention(Target.id)} (${escapeMarkdown(Target.username)}).`,
                '',
                'Custom sanctions are separate: they do not count towards the Community Rules, Racism or Inappropriate Profile steps.',
            ].join('\n'),
        )
        .setColor(CustomSanctionColour);
    const Menu = new StringSelectMenuBuilder()
        .setCustomId(BuildCustomId(ModPanelActions.CustomType, OwnerId, Target.id))
        .setPlaceholder('Choose a sanction')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Mute').setValue(CustomSanctionKinds.Mute).setDescription('Mute for a time you choose (e.g. 5m, 3h, 2d)').setEmoji({ name: '🔇' }),
            new StringSelectMenuOptionBuilder().setLabel('Kick').setValue(CustomSanctionKinds.Kick).setDescription('Remove them from the server').setEmoji({ name: '👢' }),
            new StringSelectMenuOptionBuilder().setLabel('Ban').setValue(CustomSanctionKinds.Ban).setDescription('Permanently ban them from the server').setEmoji({ name: '🚨' }),
        );
    return { ...View(Embed, [new ActionRowBuilder().addComponents(Menu)]), allowedMentions: { parse: [] } };
}

// "Are you sure?" before a custom kick or ban. The reasons are asked for after "Yes".
export function BuildCustomConfirmView(OwnerId, Target, Kind) {
    const Verb = Kind === CustomSanctionKinds.Kick ? 'kick' : 'ban';
    const Embed = new EmbedBuilder()
        .setTitle(`🛠️ Custom Sanction: ${Kind}`)
        .setDescription(
            [
                `**Are you sure you want to ${Verb} ${userMention(Target.id)} (${escapeMarkdown(Target.username)})?**`,
                '',
                Kind === CustomSanctionKinds.Kick ? 'They will be removed from the server, but can rejoin.' : 'They will be permanently banned from the server.',
                "You will be asked for the reasons next. Nothing happens until you send them.",
            ].join('\n'),
        )
        .setColor(Colours.Danger);
    const AvatarUrl = Target.displayAvatarURL?.();
    if (AvatarUrl) {
        Embed.setThumbnail(AvatarUrl);
    }
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BuildCustomId(ModPanelActions.CustomConfirm, OwnerId, Target.id, Kind))
            .setLabel(`Yes, ${Kind} User`)
            .setEmoji({ name: Kind === CustomSanctionKinds.Kick ? '👢' : '🚨' })
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(BuildCustomId(ModPanelActions.CustomCancel, OwnerId, Target.id)).setLabel('No, Cancel').setEmoji({ name: '❌' }).setStyle(ButtonStyle.Secondary),
    );
    return { ...View(Embed, [Row]), allowedMentions: { parse: [] } };
}

// The reasons form, with the mute length first for a mute.
export function BuildCustomSanctionModal(OwnerId, TargetId, Kind) {
    const Rows = [];
    if (Kind === CustomSanctionKinds.Mute) {
        Rows.push(TextInputRow(DurationInputId, 'MUTE LENGTH', TextInputStyle.Short, 'e.g. 5m for 5 minutes, 3h for 3 hours, 2d for 2 days (max 28d)', 20));
    }
    Rows.push(
        TextInputRow(ReasonInputs.PrivateReason, 'INTERNAL REASON', TextInputStyle.Paragraph, 'Explanation for the moderation team. Only shared in Mod Actions.', 800),
        TextInputRow(ReasonInputs.PublicReason, 'PUBLIC REASON', TextInputStyle.Paragraph, 'Reason sent to the user. Keep it short, one paragraph at most.', 500),
        TextInputRow(ReasonInputs.MessageLink, 'MESSAGE LINK (OPTIONAL)', TextInputStyle.Short, 'Link to the message(s) or logs as proof. If deleted, use the link from the logs.', 500, false),
    );
    return new ModalBuilder()
        .setCustomId(BuildCustomId(ModPanelActions.CustomForm, OwnerId, TargetId, Kind))
        .setTitle(`Custom Sanction: ${Kind}`)
        .addComponents(...Rows);
}

// The DM the member receives.
export function BuildCustomSanctionDmView(UserId, GuildType, PublicReason, Kind, Duration = null) {
    const Outcomes = {
        [CustomSanctionKinds.Mute]: `**You have been muted for ${Duration?.Label.toLowerCase()}.**`,
        [CustomSanctionKinds.Kick]: '**You have been removed from the server.**',
        [CustomSanctionKinds.Ban]: '**You have been banned from the server.**',
    };
    return BuildSanctionDmView(UserId, GuildType, 'sanction', PublicReason, Outcomes[Kind]);
}
