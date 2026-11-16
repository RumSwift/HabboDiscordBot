import { MessageFlags } from 'discord.js';
import { NoMentions } from '../DiscordAuditLogService.js';

// The channel, then its parent channel (for threads) and category, so excluding a category covers everything in it.
export function GetChannelLineage(Channel) {
    const Ids = [];
    for (let Current = Channel; Current && Ids.length < 3; Current = Current.parent) {
        Ids.push(Current.id);
    }
    return Ids;
}

// Shared by every log type: posts to the server's own log channel, unless the source channel is excluded.
// Build returns { Card, Files } (a Components V2 container) and only runs once the checks pass,
// so nothing is downloaded for excluded channels.
export class GuildLogService {
    constructor({ Client, GuildConfigurationRepository, Logger }) {
        this.Client = Client;
        this.GuildConfigurationRepository = GuildConfigurationRepository;
        this.Logger = Logger;
    }

    async Send({ GuildId, ChannelType, SourceChannel, Build }) {
        const LogChannelId = await this.GuildConfigurationRepository.GetLogChannelId(GuildId, ChannelType);
        if (!LogChannelId) {
            return false;
        }

        const SourceIds = GetChannelLineage(SourceChannel);
        if (SourceIds.includes(LogChannelId)) {
            return false;
        }
        const ExcludedIds = await this.GuildConfigurationRepository.GetExcludedChannelIds(GuildId);
        if (SourceIds.some((Id) => ExcludedIds.has(Id))) {
            return false;
        }

        const LogChannel = await this.Client.channels.fetch(LogChannelId).catch(() => null);
        if (!LogChannel?.isTextBased?.() || typeof LogChannel.send !== 'function') {
            this.Logger.Warn('Log channel is missing or is not a text channel. Check the GuildLogChannels table.', { GuildId, ChannelType, ChannelId: LogChannelId });
            return false;
        }

        const { Card, Files = [] } = await Build();
        try {
            // The posted message (truthy), so callers can link to it.
            return await LogChannel.send({ components: [Card], files: Files, flags: MessageFlags.IsComponentsV2, allowedMentions: NoMentions });
        } catch (SendError) {
            this.Logger.Warn('Could not post to log channel (check the bot can view, send and attach files there)', { GuildId, ChannelType, ChannelId: LogChannelId, Error: SendError });
            return false;
        }
    }
}
