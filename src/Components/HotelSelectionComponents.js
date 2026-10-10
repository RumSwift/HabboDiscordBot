import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Hotels } from '../Utils/HotelConfiguration.js';
import { Colours, Thumbnails, View } from './ComponentStyles.js';

const MaxButtonsPerRow = 5; // Discord limit

export function BuildHotelSelectionView({ OwnerDiscordUserId, ActiveLink }) {
    let Description = 'Thanks for choosing to link your Habbo account!\n\nFirst, select the hotel where your Habbo account is registered.';
    if (ActiveLink) {
        Description +=
            `\n\n**Note:** your Discord account is currently linked to **${ActiveLink.HabboUsername}** (${ActiveLink.HotelCode}). ` +
            'Successfully completing verification will replace that link. If you cancel or verification fails, your current link stays as it is.';
    }

    const Embed = new EmbedBuilder()
        .setTitle('Link Your Habbo Account')
        .setDescription(Description)
        .setColor(Colours.Primary)
        .setThumbnail(Thumbnails.HotelSelection);

    const HotelButtons = Hotels.map((Hotel) =>
        new ButtonBuilder()
            .setCustomId(BuildCustomId('SelectHotel', OwnerDiscordUserId, Hotel.HotelCode))
            .setLabel(Hotel.Label)
            .setStyle(ButtonStyle.Secondary),
    );

    const Rows = [];
    for (let Index = 0; Index < HotelButtons.length; Index += MaxButtonsPerRow) {
        Rows.push(new ActionRowBuilder().addComponents(HotelButtons.slice(Index, Index + MaxButtonsPerRow)));
    }
    Rows.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(BuildCustomId('Cancel', OwnerDiscordUserId)).setLabel('Cancel').setStyle(ButtonStyle.Danger),
        ),
    );

    return View(Embed, Rows);
}
