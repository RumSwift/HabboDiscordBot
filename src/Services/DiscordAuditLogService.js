import { EmbedBuilder, time, TimestampStyles, userMention } from 'discord.js';
import { PermanentError } from '../Utils/RetryPolicy.js';
import { GetHotel } from '../Utils/HotelConfiguration.js';

const LinkedColour = 0x2ecc71;
const UnlinkedColour = 0xe67e22;

export const NoMentions = Object.freeze({ parse: [], users: [], roles: [], repliedUser: false });

function FormatTimestamp(Value) {
    const DateValue = Value instanceof Date ? Value : new Date(Value);
    return `${time(DateValue, TimestampStyles.LongDateTime)} (${time(DateValue, TimestampStyles.RelativeTime)})`;
}

export function BuildAvatarImageUrl(HotelCode, HabboUsername, Gesture) {
    const Hostname = GetHotel(HotelCode).Hostname;
    const Query = `user=${encodeURIComponent(HabboUsername)}&direction=4&head_direction=3&gesture=${Gesture}&size=m&headonly=1`;
    return `https://${Hostname}/habbo-imaging/avatarimage?${Query}`;
}

export function BuildAuditEmbed(AuditEvent) {
    const IsLinked = AuditEvent.ActionType === 'LINKED';

    return new EmbedBuilder()
        .setTitle(IsLinked ? '✅ Habbo Account Linked' : '❌ Habbo Account Unlinked')
        .setColor(IsLinked ? LinkedColour : UnlinkedColour)
        .setThumbnail(BuildAvatarImageUrl(AuditEvent.HotelCode, AuditEvent.HabboUsername, IsLinked ? 'sml' : 'sad'))
        .addFields(
            { name: 'Discord User', value: `${userMention(AuditEvent.DiscordUserId)} (${AuditEvent.DiscordUserId})` },
            { name: 'Habbo Username', value: AuditEvent.HabboUsername },
            { name: 'Hotel', value: AuditEvent.HotelCode },
            { name: IsLinked ? 'Linked At' : 'Unlinked At', value: FormatTimestamp(AuditEvent.EventTimestamp) },
        );
}

export class DiscordAuditLogService {
    constructor({ Client, LogThreadId, Logger }) {
        this.Client = Client;
        this.LogThreadId = LogThreadId;
        this.Logger = Logger;
    }

    IsConfigured() {
        return Boolean(this.LogThreadId);
    }

    async SendAuditEvent(AuditEvent) {
        if (!this.IsConfigured()) {
            throw new Error('DISCORD_LOG_THREAD_ID is not configured.');
        }
        if (!this.Client?.isReady?.()) {
            throw new Error('Discord client is not ready.');
        }

        const Thread = await this.Client.channels.fetch(this.LogThreadId);
        if (!Thread) {
            throw new PermanentError(`Logging thread ${this.LogThreadId} was not found.`);
        }
        if (!Thread.isThread()) {
            throw new PermanentError(`Channel ${this.LogThreadId} is not a thread. DISCORD_LOG_THREAD_ID must be the ID of an existing thread.`);
        }

        const Message = await Thread.send({ embeds: [BuildAuditEmbed(AuditEvent)], allowedMentions: NoMentions });
        return Message.id;
    }
}
