import { ButtonBuilder, ButtonStyle, channelMention } from 'discord.js';
import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatCodeBlock } from './LogCard.js';

const MaxMessageLength = 3000; // leaves room for the rest of the card within Discord's 4000-character total

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

export class SayLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    // Always logged, even in channels excluded with /stoplogs, because it records a staff action.
    async HandleSay({ Staff, GuildId, Message }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.Say,
            SourceChannel: null,
            Build: async () => ({ Card: BuildSayCard(Staff, Message) }),
        });
    }
}
