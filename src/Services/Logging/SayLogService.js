import { ButtonBuilder, ButtonStyle, channelMention, roleMention } from 'discord.js';
import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatCodeBlock } from './LogCard.js';

const MaxMessageLength = 3000;
const MaxEmbedDescriptionLength = 2500;

export function BuildSayCard(Staff, Message, { Now = new Date() } = {}) {
    return BuildLogCard({
        Title: '💬 Message Sent as Bot',
        User: Staff,
        Colour: Colours.Primary,
        Fields: [
            { Label: 'Channel', Value: channelMention(Message.channelId) },
            { Label: 'Message', Value: FormatCodeBlock(Message.content, MaxMessageLength) },
        ],
        FooterNotes: [`Message ID: ${Message.id}`],
        Buttons: [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Jump to Message').setURL(Message.url)],
        Now,
    });
}

export function BuildSayEmbedCard(Staff, Message, { Now = new Date() } = {}) {
    const Embed = Message.embeds?.[0] ?? {};
    const Fields = [{ Label: 'Channel', Value: channelMention(Message.channelId) }];
    const TaggedRoleId = /^<@&(\d{17,20})>$/.exec(Message.content ?? '')?.[1];
    if (TaggedRoleId) {
        Fields.push({ Label: 'Tagged', Value: roleMention(TaggedRoleId) });
    } else if (['@everyone', '@here'].includes(Message.content)) {
        Fields.push({ Label: 'Tagged', Value: `\`${Message.content}\`` });
    }
    if (Embed.title) {
        Fields.push({ Label: 'Title', Value: FormatCodeBlock(Embed.title, 256) });
    }
    Fields.push({ Label: 'Description', Value: FormatCodeBlock(Embed.description ?? '', MaxEmbedDescriptionLength) });
    if (Embed.footer?.text) {
        Fields.push({ Label: 'Footer', Value: FormatCodeBlock(Embed.footer.text, 300) });
    }
    if (Embed.image?.url) {
        Fields.push({ Label: 'Image', Value: Embed.image.url });
    }
    return BuildLogCard({
        Title: '🖼️ Embed Sent as Bot',
        User: Staff,
        Colour: Embed.color ?? Colours.Primary,
        Fields,
        FooterNotes: [`Message ID: ${Message.id}`],
        Buttons: [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Jump to Message').setURL(Message.url)],
        Now,
    });
}

export class SayLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async HandleSay({ Staff, GuildId, Message }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.Say,
            SourceChannel: null,
            Build: async () => ({ Card: BuildSayCard(Staff, Message) }),
        });
    }

    async HandleSayEmbed({ Staff, GuildId, Message }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.SayEmbed,
            SourceChannel: null,
            Build: async () => ({ Card: BuildSayEmbedCard(Staff, Message) }),
        });
    }
}
