import { ButtonBuilder, ButtonStyle, channelMention } from 'discord.js';
import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatCodeBlock } from './LogCard.js';

const MaxVersionLength = 1700; // before and after both have to fit in Discord's 4000-character total

function FormatVersion(Content) {
    return Content ? FormatCodeBlock(Content, MaxVersionLength) : '*No text*';
}

export function BuildMessageEditedCard(OldMessage, NewMessage, { Now = new Date() } = {}) {
    return BuildLogCard({
        Title: '✏️ Message Edited',
        User: NewMessage.author,
        Colour: Colours.Warning,
        Fields: [
            { Label: 'Channel', Value: channelMention(NewMessage.channelId) },
            { Label: 'Original', Value: FormatVersion(OldMessage.content) },
            { Label: 'Edited', Value: FormatVersion(NewMessage.content) },
        ],
        FooterNotes: [`Message ID: ${NewMessage.id}`],
        Buttons: [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Jump to Message').setURL(NewMessage.url)],
        Now,
    });
}

export class MessageEditLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async HandleMessageUpdate(OldMessage, NewMessage) {
        // Uncached messages have no original text. Discord also sends updates when a link preview loads, so only text changes count.
        if (OldMessage.partial || NewMessage.partial || !NewMessage.guildId || !NewMessage.author || NewMessage.author.bot) {
            return false;
        }
        if (OldMessage.content === NewMessage.content) {
            return false;
        }
        return this.GuildLogService.Send({
            GuildId: NewMessage.guildId,
            ChannelType: LogChannelTypes.MessageEdit,
            SourceChannel: NewMessage.channel,
            Build: async () => ({ Card: BuildMessageEditedCard(OldMessage, NewMessage) }),
        });
    }
}
