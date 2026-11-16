import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, time, TimestampStyles } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { FormatHotel, GameLabels, Games } from '../Utils/HotelConfiguration.js';
import { Colours, Thumbnails, View } from './ComponentStyles.js';

export function FormatLinkedAccount(Link) {
    return `**${escapeMarkdown(Link.HabboUsername)}** (${FormatHotel(Link.HotelCode)})`;
}

export function BuildDashboardView({ OwnerDiscordUserId, ActiveLinks }) {
    const Embed = new EmbedBuilder()
        .setTitle('Welcome to the Habbo Discord Verify Dashboard')
        .setDescription(
            'Welcome to the Habbo verification dashboard!\n\n' +
                'Here you can link your Habbo and Habbo Origins accounts to your Discord account, allowing us to confirm that you own them.\n\n' +
                'You can link one Habbo account and one Habbo Origins account, and unlink or replace either of them whenever you need to.',
        )
        .setColor(Colours.Primary)
        .setThumbnail(Thumbnails.Dashboard);

    for (const Game of Object.values(Games)) {
        const Link = ActiveLinks.find((Candidate) => Candidate.Game === Game);
        Embed.addFields({
            name: `${GameLabels[Game]} Account`,
            value: Link ? `${FormatLinkedAccount(Link)} since ${time(new Date(Link.LinkedTimestamp), TimestampStyles.LongDate)}` : 'Not linked',
        });
    }

    const Buttons = [new ButtonBuilder().setCustomId(BuildCustomId('Link', OwnerDiscordUserId)).setLabel('Link').setStyle(ButtonStyle.Success)];
    if (ActiveLinks.length > 0) {
        Buttons.push(new ButtonBuilder().setCustomId(BuildCustomId('Unlink', OwnerDiscordUserId)).setLabel('Unlink').setStyle(ButtonStyle.Danger));
    }

    return View(Embed, [new ActionRowBuilder().addComponents(Buttons)]);
}
