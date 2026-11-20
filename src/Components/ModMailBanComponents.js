import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, time, TimestampStyles, userMention } from 'discord.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';
import { FormatBanEnd } from '../Services/Logging/ModActionLogService.js';
import { BuildCustomId } from '../Utils/CustomId.js';

const HourMs = 60 * 60 * 1000;

export const BanDurations = Object.freeze({
    H: { Label: '1 Hour', Ms: HourMs },
    D: { Label: '1 Day', Ms: 24 * HourMs },
    W: { Label: '1 Week', Ms: 7 * 24 * HourMs },
    P: { Label: 'Permanent', Ms: null },
});

export const ModMailBanActions = Object.freeze({
    Apply: 'ModMailBanApply',
    Unban: 'ModMailBanUnban',
    ExtendMenu: 'ModMailBanExtendMenu',
    Extend: 'ModMailBanExtend',
    Back: 'ModMailBanBack',
});

export function DescribeDuration(Key) {
    return Key === 'P' ? 'permanently' : `for ${BanDurations[Key].Label.toLowerCase()}`;
}

function Thumbnail(Embed, Target) {
    const AvatarUrl = Target.displayAvatarURL?.();
    return AvatarUrl ? Embed.setThumbnail(AvatarUrl) : Embed;
}

export function BuildBanPanelView(OwnerDiscordUserId, Target, Ban) {
    const Name = escapeMarkdown(Target.username);
    if (!Ban) {
        const Embed = new EmbedBuilder()
            .setColor(Colours.Primary)
            .setTitle('🛡️ Mod Mail Ban')
            .setDescription(`${userMention(Target.id)} (${Name}) can currently use Mod Mail and /dmmod in this server.\n\nHow long should they be banned for?`);
        const Row = new ActionRowBuilder().addComponents(
            Object.entries(BanDurations).map(([Key, Duration]) =>
                new ButtonBuilder()
                    .setCustomId(BuildCustomId(ModMailBanActions.Apply, OwnerDiscordUserId, Target.id, Key))
                    .setLabel(Duration.Label)
                    .setStyle(Key === 'P' ? ButtonStyle.Danger : ButtonStyle.Secondary),
            ),
        );
        return View(Thumbnail(Embed, Target), [Row]);
    }

    const Embed = new EmbedBuilder()
        .setColor(Colours.Danger)
        .setTitle('🚫 Banned From Mod Mail')
        .setDescription(`${userMention(Target.id)} (${Name}) is banned from using Mod Mail and /dmmod in this server.`)
        .addFields(
            { name: 'Banned By', value: userMention(Ban.BannedByDiscordUserId) },
            { name: 'Since', value: `${time(Ban.CreatedTimestamp, TimestampStyles.LongDateTime)} (${time(Ban.CreatedTimestamp, TimestampStyles.RelativeTime)})` },
            { name: 'Ends', value: FormatBanEnd(Ban.ExpiresTimestamp) },
        );
    const Buttons = [new ButtonBuilder().setCustomId(BuildCustomId(ModMailBanActions.Unban, OwnerDiscordUserId, Target.id)).setLabel('Unban').setStyle(ButtonStyle.Success)];
    if (Ban.ExpiresTimestamp) {
        Buttons.push(new ButtonBuilder().setCustomId(BuildCustomId(ModMailBanActions.ExtendMenu, OwnerDiscordUserId, Target.id)).setLabel('Extend').setStyle(ButtonStyle.Primary));
    }
    return View(Thumbnail(Embed, Target), [new ActionRowBuilder().addComponents(Buttons)]);
}

export function BuildExtendPanelView(OwnerDiscordUserId, Target, Ban) {
    const Embed = new EmbedBuilder()
        .setColor(Colours.Warning)
        .setTitle('⏳ Extend Mod Mail Ban')
        .setDescription(`${userMention(Target.id)}'s ban currently ends ${FormatBanEnd(Ban.ExpiresTimestamp)}.\n\nExtend it by how long?`);
    const Row = new ActionRowBuilder().addComponents(
        ...Object.entries(BanDurations).map(([Key, Duration]) =>
            new ButtonBuilder()
                .setCustomId(BuildCustomId(ModMailBanActions.Extend, OwnerDiscordUserId, Target.id, Key))
                .setLabel(Key === 'P' ? 'Make Permanent' : `+ ${Duration.Label}`)
                .setStyle(Key === 'P' ? ButtonStyle.Danger : ButtonStyle.Secondary),
        ),
        new ButtonBuilder().setCustomId(BuildCustomId(ModMailBanActions.Back, OwnerDiscordUserId, Target.id)).setLabel('Back').setStyle(ButtonStyle.Secondary),
    );
    return View(Thumbnail(Embed, Target), [Row]);
}

export function BuildBanResultView(Title, Description, { Success = true } = {}) {
    const Embed = new EmbedBuilder()
        .setTitle(Title)
        .setDescription(Description)
        .setColor(Success ? Colours.Success : Colours.Danger);
    if (Success) {
        Embed.setFooter({ text: SelfDestructNote });
    }
    return View(Embed);
}
