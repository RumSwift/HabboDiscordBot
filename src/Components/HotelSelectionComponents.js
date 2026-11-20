import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { GameLabels, Games, GetHotelsForGame } from '../Utils/HotelConfiguration.js';
import { Colours, Thumbnails, View } from './ComponentStyles.js';
import { FormatLinkedAccount } from './DashboardComponents.js';

const MaxButtonsPerRow = 5;

function CancelButton(OwnerDiscordUserId) {
    return new ButtonBuilder().setCustomId(BuildCustomId('Cancel', OwnerDiscordUserId)).setLabel('Cancel').setStyle(ButtonStyle.Danger);
}

export function BuildGameSelectionView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Link an Account')
        .setDescription('Thanks for choosing to link an account!\n\nFirst, choose whether you want to link a **Habbo** account or a **Habbo Origins** account.')
        .setColor(Colours.Primary)
        .setThumbnail(Thumbnails.HotelSelection);

    const Row = new ActionRowBuilder().addComponents(
        ...Object.values(Games).map((Game) =>
            new ButtonBuilder().setCustomId(BuildCustomId('SelectGame', OwnerDiscordUserId, Game)).setLabel(GameLabels[Game]).setStyle(ButtonStyle.Primary),
        ),
        CancelButton(OwnerDiscordUserId),
    );
    return View(Embed, [Row]);
}

export function BuildHotelSelectionView({ OwnerDiscordUserId, Game, ActiveLink }) {
    const GameLabel = GameLabels[Game];
    let Description = `Select the hotel where your ${GameLabel} account is registered.`;
    if (ActiveLink) {
        Description +=
            `\n\n**Note:** your Discord account is currently linked to the ${GameLabel} account ${FormatLinkedAccount(ActiveLink)}. ` +
            'Successfully completing verification will replace that link. If you cancel or verification fails, your current link stays as it is.';
    }

    const Embed = new EmbedBuilder()
        .setTitle(`Link Your ${GameLabel} Account`)
        .setDescription(Description)
        .setColor(Colours.Primary)
        .setThumbnail(Thumbnails.HotelSelection);

    const HotelButtons = GetHotelsForGame(Game).map((Hotel) =>
        new ButtonBuilder()
            .setCustomId(BuildCustomId('SelectHotel', OwnerDiscordUserId, Hotel.HotelCode))
            .setLabel(Hotel.Label)
            .setEmoji(Hotel.Emoji)
            .setStyle(ButtonStyle.Secondary),
    );

    const Rows = [];
    for (let Index = 0; Index < HotelButtons.length; Index += MaxButtonsPerRow) {
        Rows.push(new ActionRowBuilder().addComponents(HotelButtons.slice(Index, Index + MaxButtonsPerRow)));
    }
    Rows.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(BuildCustomId('Link', OwnerDiscordUserId)).setLabel('Back').setStyle(ButtonStyle.Secondary),
            CancelButton(OwnerDiscordUserId),
        ),
    );

    return View(Embed, Rows);
}
