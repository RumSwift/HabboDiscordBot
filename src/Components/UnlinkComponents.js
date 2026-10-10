import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Colours, StartAgainRow, Thumbnails, VerifyCommandText, View } from './ComponentStyles.js';

export function BuildUnlinkConfirmationView({ OwnerDiscordUserId, ActiveLink }) {
    const Embed = new EmbedBuilder()
        .setTitle('Unlink Habbo Account')
        .setDescription(
            'Are you sure you want to unlink your Habbo account from your Discord account?\n\n' +
                'Unlinking will remove the association between these accounts and remove the verification role associated with that hotel.',
        )
        .addFields({ name: 'Linked Account', value: `${ActiveLink.HabboUsername} (${ActiveLink.HotelCode})` })
        .setColor(Colours.Danger)
        .setThumbnail(Thumbnails.UnlinkConfirmation);

    // The LinkId in the button ID means a stale confirmation can never unlink a newer link.
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('ConfirmUnlink', OwnerDiscordUserId, ActiveLink.LinkId)).setLabel('Confirm Unlink').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(BuildCustomId('Dashboard', OwnerDiscordUserId)).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    return View(Embed, [Row]);
}

export function BuildUnlinkedView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Account Unlinked')
        .setDescription(
            'Your Habbo account has been successfully unlinked from your Discord account.\n\n' + `You can link another account at any time using ${VerifyCommandText}.`,
        )
        .setColor(Colours.Success)
        .setThumbnail(Thumbnails.Unlinked);
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('Link', OwnerDiscordUserId)).setLabel('Link Another Account').setStyle(ButtonStyle.Primary),
    );
    return View(Embed, [Row]);
}

export function BuildNoActiveLinkView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('No Linked Account')
        .setDescription('Your Discord account is not currently linked to a Habbo account (or the link has changed since this menu was opened).')
        .setColor(Colours.Neutral);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}
