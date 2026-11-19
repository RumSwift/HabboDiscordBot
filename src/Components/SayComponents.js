import { ActionRowBuilder, ButtonBuilder, ButtonStyle, channelMention, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';

export function BuildSaySentView(Message) {
    const Embed = new EmbedBuilder().setTitle('Message Sent').setDescription(`Sent in ${channelMention(Message.channelId)}.`).setColor(Colours.Success).setFooter({ text: SelfDestructNote });
    const Row = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Jump to Message').setURL(Message.url));
    return View(Embed, [Row]);
}

export function BuildSayFailedView(Channel, Reason) {
    const Where = Channel ? ` in ${channelMention(Channel.id)}` : '';
    return View(new EmbedBuilder().setTitle('Message Not Sent').setDescription(`Could not send${Where}. ${Reason}`).setColor(Colours.Danger));
}

export const SayEmbedModalAction = 'SayEmbedModal';
export const SayEmbedRetryAction = 'SayEmbedRetry';
export const SayEmbedTitleInputId = 'Title';
export const SayEmbedContentInputId = 'Content';
export const SayEmbedColourInputId = 'Colour';

// Habbo orange: the orange side of the Habbo logo.
export const DefaultSayEmbedColour = '#FF6600';

// The /sayembed form. Key points at the command's options, which the bot keeps while the form is open.
// Draft refills the boxes when the form is reopened after a mistake.
export function BuildSayEmbedModal(OwnerDiscordUserId, Key, ChannelName, Draft = {}) {
    const Input = (Id, Label, Style, MaxLength, Required, Value) => {
        const Builder = new TextInputBuilder().setCustomId(Id).setLabel(Label).setStyle(Style).setRequired(Required).setMaxLength(MaxLength);
        if (Value) {
            Builder.setValue(Value);
        }
        return new ActionRowBuilder().addComponents(Builder);
    };
    return new ModalBuilder()
        .setCustomId(BuildCustomId(SayEmbedModalAction, OwnerDiscordUserId, Key))
        .setTitle(`Send an embed in #${ChannelName ?? 'channel'}`.slice(0, 45))
        .addComponents(
            Input(SayEmbedTitleInputId, 'Title', TextInputStyle.Short, 256, false, Draft.Title),
            Input(SayEmbedContentInputId, 'Content', TextInputStyle.Paragraph, 4000, true, Draft.Content),
            Input(SayEmbedColourInputId, 'Colour (hex code)', TextInputStyle.Short, 7, false, Draft.Colour ?? DefaultSayEmbedColour),
        );
}

// Shown when the form had a mistake: the button reopens it with what was typed.
export function BuildSayEmbedRetryView(OwnerDiscordUserId, Key, Reason) {
    const Embed = new EmbedBuilder().setTitle('Message Not Sent').setDescription(`${Reason} Your title and content are kept: press Try Again to fix it.`).setColor(Colours.Danger);
    const Row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(BuildCustomId(SayEmbedRetryAction, OwnerDiscordUserId, Key)).setLabel('Try Again').setStyle(ButtonStyle.Primary));
    return View(Embed, [Row]);
}
