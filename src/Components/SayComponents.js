import { ActionRowBuilder, ButtonBuilder, ButtonStyle, channelMention, EmbedBuilder } from 'discord.js';
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
