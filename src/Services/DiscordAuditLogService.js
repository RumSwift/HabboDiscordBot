import { EmbedBuilder, time, TimestampStyles, userMention } from 'discord.js';
import { PermanentError } from '../Utils/RetryPolicy.js';
import { FormatHotelWithFlag, GameLabels, Games, GetHotel } from '../Utils/HotelConfiguration.js';
import { Emojis, FormatEmoji } from '../Components/ComponentStyles.js';

const Colours = Object.freeze({
    [Games.Habbo]: { Linked: 0x2ecc71, Unlinked: 0xe67e22 },
    [Games.Origins]: { Linked: 0x1abc9c, Unlinked: 0xc0392b },
});

export const NoMentions = Object.freeze({ parse: [], users: [], roles: [], repliedUser: false });

function FormatTimestamp(Value) {
    const DateValue = Value instanceof Date ? Value : new Date(Value);
    return `${time(DateValue, TimestampStyles.LongDateTime)} (${time(DateValue, TimestampStyles.RelativeTime)})`;
}

// Origins has no avatar image service, so Origins events have no picture.
export function BuildAvatarImageUrl(HotelCode, HabboUsername, Gesture) {
    const Hotel = GetHotel(HotelCode);
    if (Hotel.Game !== Games.Habbo) {
        return null;
    }
    const Query = `user=${encodeURIComponent(HabboUsername)}&direction=4&head_direction=3&gesture=${Gesture}&size=m&headonly=1`;
    return `https://${Hotel.Hostname}/habbo-imaging/avatarimage?${Query}`;
}

export function BuildAuditEmbed(AuditEvent) {
    const IsLinked = AuditEvent.ActionType === 'LINKED';
    const Game = GetHotel(AuditEvent.HotelCode).Game;

    const Embed = new EmbedBuilder()
        .setTitle(`${FormatEmoji(IsLinked ? Emojis.Plus : Emojis.Minus)} ${GameLabels[Game]} Account ${IsLinked ? 'Linked' : 'Unlinked'}`)
        .setColor(Colours[Game][IsLinked ? 'Linked' : 'Unlinked'])
        .addFields(
            { name: 'Discord User', value: `${userMention(AuditEvent.DiscordUserId)} (${AuditEvent.DiscordUserId})` },
            { name: `${GameLabels[Game]} Username`, value: AuditEvent.HabboUsername },
            { name: 'Hotel', value: FormatHotelWithFlag(AuditEvent.HotelCode) },
            { name: IsLinked ? 'Linked At' : 'Unlinked At', value: FormatTimestamp(AuditEvent.EventTimestamp) },
        );
    const AvatarUrl = BuildAvatarImageUrl(AuditEvent.HotelCode, AuditEvent.HabboUsername, IsLinked ? 'sml' : 'sad');
    if (AvatarUrl) {
        Embed.setThumbnail(AvatarUrl);
    }
    return Embed;
}

export class DiscordAuditLogService {
    constructor({ Client, Logger }) {
        this.Client = Client;
        this.Logger = Logger;
    }

    async SendAuditEvent(AuditEvent) {
        if (!AuditEvent.ChannelId) {
            throw new PermanentError('Notification has no logging channel.');
        }
        if (!this.Client?.isReady?.()) {
            throw new Error('Discord client is not ready.');
        }

        const Channel = await this.Client.channels.fetch(AuditEvent.ChannelId);
        if (!Channel) {
            throw new PermanentError(`Logging channel ${AuditEvent.ChannelId} was not found.`);
        }
        if (!Channel.isTextBased?.() || typeof Channel.send !== 'function') {
            throw new PermanentError(`Channel ${AuditEvent.ChannelId} is not a text channel or thread. Check the GuildLogChannels table.`);
        }

        const Message = await Channel.send({ embeds: [BuildAuditEmbed(AuditEvent)], allowedMentions: NoMentions });
        return Message.id;
    }
}
