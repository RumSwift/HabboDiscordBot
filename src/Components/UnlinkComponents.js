import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { GameLabels } from '../Utils/HotelConfiguration.js';
import { Colours, SelfDestructNote, StartAgainRow, Thumbnails, VerifyCommandText, View } from './ComponentStyles.js';
import { FormatLinkedAccount } from './DashboardComponents.js';

function BackButton(OwnerDiscordUserId) {
    return new ButtonBuilder().setCustomId(BuildCustomId('Dashboard', OwnerDiscordUserId)).setLabel('Cancel').setStyle(ButtonStyle.Secondary);
}

export function BuildUnlinkChoiceView({ OwnerDiscordUserId, ActiveLinks }) {
    const Embed = new EmbedBuilder()
        .setTitle('Unlink an Account')
        .setDescription(
            'Which account do you want to unlink? The other one stays linked.\n\n' +
                ActiveLinks.map((Link) => `**${GameLabels[Link.Game]}:** ${FormatLinkedAccount(Link)}`).join('\n'),
        )
        .setColor(Colours.Danger)
        .setThumbnail(Thumbnails.UnlinkConfirmation);

    const Row = new ActionRowBuilder().addComponents(
        ...ActiveLinks.map((Link) =>
            new ButtonBuilder().setCustomId(BuildCustomId('UnlinkGame', OwnerDiscordUserId, Link.Game)).setLabel(`Unlink ${GameLabels[Link.Game]}`).setStyle(ButtonStyle.Danger),
        ),
        BackButton(OwnerDiscordUserId),
    );
    return View(Embed, [Row]);
}

export function BuildUnlinkConfirmationView({ OwnerDiscordUserId, ActiveLink }) {
    const GameLabel = GameLabels[ActiveLink.Game];
    const Embed = new EmbedBuilder()
        .setTitle(`Unlink ${GameLabel} Account`)
        .setDescription(
            `Are you sure you want to unlink your ${GameLabel} account from your Discord account?\n\n` +
                'Unlinking will remove the association between these accounts and remove the verification role associated with that hotel.',
        )
        .addFields({ name: 'Linked Account', value: FormatLinkedAccount(ActiveLink) })
        .setColor(Colours.Danger)
        .setThumbnail(Thumbnails.UnlinkConfirmation);

    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('ConfirmUnlink', OwnerDiscordUserId, ActiveLink.LinkId)).setLabel('Confirm Unlink').setStyle(ButtonStyle.Danger),
        BackButton(OwnerDiscordUserId),
    );
    return View(Embed, [Row]);
}

export function BuildUnlinkedView({ OwnerDiscordUserId, Game }) {
    const Embed = new EmbedBuilder()
        .setTitle('Account Unlinked')
        .setDescription(
            `Your ${GameLabels[Game]} account has been successfully unlinked from your Discord account.\n\n` + `You can link another account at any time using ${VerifyCommandText}.`,
        )
        .setColor(Colours.Success)
        .setThumbnail(Thumbnails.Unlinked)
        .setFooter({ text: SelfDestructNote });
    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('Link', OwnerDiscordUserId)).setLabel('Link Another Account').setStyle(ButtonStyle.Primary),
    );
    return View(Embed, [Row]);
}

export function BuildNoActiveLinkView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('No Linked Account')
        .setDescription('Your Discord account is not currently linked to that account (or the link has changed since this menu was opened).')
        .setColor(Colours.Neutral);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}
