import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, time, TimestampStyles } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Colours, Thumbnails, View } from './ComponentStyles.js';

export function BuildDashboardView({ OwnerDiscordUserId, ActiveLink }) {
    const Embed = new EmbedBuilder()
        .setTitle('Welcome to the Habbo Discord Verify Dashboard')
        .setDescription(
            'Welcome to the Habbo verification dashboard!\n\n' +
                'Here you can link your Habbo account to your Discord account, allowing us to confirm that you own the account.\n\n' +
                'You can link an account, unlink your current account or link a different Habbo account whenever you need to.',
        )
        .setColor(Colours.Primary)
        .setThumbnail(Thumbnails.Dashboard);

    if (ActiveLink) {
        Embed.addFields({
            name: 'Currently Linked Account',
            value: `**${ActiveLink.HabboUsername}** (${ActiveLink.HotelCode}) since ${time(new Date(ActiveLink.LinkedTimestamp), TimestampStyles.LongDate)}`,
        });
    }

    const Buttons = [new ButtonBuilder().setCustomId(BuildCustomId('Link', OwnerDiscordUserId)).setLabel('Link').setStyle(ButtonStyle.Success)];
    if (ActiveLink) {
        Buttons.push(new ButtonBuilder().setCustomId(BuildCustomId('Unlink', OwnerDiscordUserId)).setLabel('Unlink').setStyle(ButtonStyle.Danger));
    }

    return View(Embed, [new ActionRowBuilder().addComponents(Buttons)]);
}
