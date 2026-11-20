import { ChannelType } from 'discord.js';
import { ApiError } from '../Api/Middleware/ErrorHandler.js';
import { ExclusionOutcomes } from '../Repositories/GuildConfigurationRepository.js';
import { ExclusionChannelTypes, ServerTypes } from './AdminSettings.js';

const SnowflakePattern = /^\d{17,20}$/;

function RequireSnowflake(Value, What) {
    if (typeof Value !== 'string' || !SnowflakePattern.test(Value)) {
        throw new ApiError(400, 'INVALID_ID', `${What} must be a Discord ID (17-20 digits).`);
    }
    return Value;
}

function RequireServerType(GuildType) {
    const ServerType = ServerTypes.find((Type) => Type.GuildType === GuildType);
    if (!ServerType) {
        throw new ApiError(404, 'UNKNOWN_SERVER_TYPE', 'Unknown server type.');
    }
    return ServerType;
}

function ReadSettings(Body, Settings, What) {
    if (Body === undefined) {
        return {};
    }
    if (typeof Body !== 'object' || Body === null || Array.isArray(Body)) {
        throw new ApiError(400, 'INVALID_BODY', `${What} must be an object.`);
    }
    const Known = new Map(Settings.map((Setting) => [Setting.Type, Setting]));
    const Values = {};
    for (const [Type, Value] of Object.entries(Body)) {
        const Setting = Known.get(Type);
        if (!Setting) {
            throw new ApiError(400, 'UNKNOWN_SETTING', `Unknown setting: ${Type}.`);
        }
        Values[Type] = Value === '' || Value === null ? '' : RequireSnowflake(Value, Setting.Label);
    }
    return Values;
}

function DescribeChannelTypes(Types) {
    return Types.includes(ChannelType.GuildForum) && Types.length === 1 ? 'a forum channel' : 'a text channel or thread';
}

export class AdminService {
    constructor({ GuildConfigurationRepository, Client = null, OnConfigurationChanged = null, Logger }) {
        this.GuildConfigurationRepository = GuildConfigurationRepository;
        this.Client = Client;
        this.OnConfigurationChanged = OnConfigurationChanged;
        this.Logger = Logger;
    }

    async GetState() {
        const Saved = await this.GuildConfigurationRepository.GetConfiguration();
        const IsConnected = Boolean(this.Client?.isReady?.());
        const Servers = ServerTypes.map((ServerType) => {
            const Guild = Saved.find((Row) => Row.GuildType === ServerType.GuildType) ?? null;
            return { ...ServerType, Saved: Guild && { Name: Guild.Name, GuildId: Guild.GuildId, EnforceNicknames: Guild.EnforceNicknames, Roles: Guild.Roles, Channels: Guild.Channels, Exclusions: Guild.Exclusions } };
        });
        return { IsConnected, BotName: IsConnected ? this.Client.user?.tag ?? null : null, Servers };
    }

    CheckChannelKinds(GuildId, ServerType, Channels) {
        const Guild = this.Client?.guilds?.cache?.get(GuildId);
        for (const [Type, ChannelId] of Object.entries(Channels)) {
            const Channel = ChannelId ? Guild?.channels?.cache?.get(ChannelId) : null;
            const Setting = ServerType.Channels.find((Candidate) => Candidate.Type === Type);
            if (Channel && !Setting.ChannelTypes.includes(Channel.type)) {
                throw new ApiError(400, 'WRONG_CHANNEL_TYPE', `${Setting.Label}: #${Channel.name} is not ${DescribeChannelTypes(Setting.ChannelTypes)}.`);
            }
        }
    }

    async ClaimServer(GuildType, GuildId, { Source } = {}) {
        const ServerType = RequireServerType(GuildType);
        RequireSnowflake(GuildId, 'Server ID');
        const Saved = await this.GuildConfigurationRepository.GetGuilds();
        const Other = Saved.find((Row) => Row.GuildId === GuildId && Row.GuildType !== GuildType);
        if (Other) {
            const OtherLabel = ServerTypes.find((Type) => Type.GuildType === Other.GuildType)?.Label ?? 'other server';
            throw new ApiError(409, 'SERVER_IN_USE', `This server is already set up as the ${OtherLabel}.`);
        }
        const Current = Saved.find((Row) => Row.GuildType === GuildType);
        if (Current?.GuildId === GuildId) {
            return { Outcome: 'Unchanged' };
        }
        if (Current && this.Client?.guilds?.cache?.has(Current.GuildId)) {
            throw new ApiError(409, 'SLOT_TAKEN', `The ${ServerType.Label} is already ${Current.Name} (${Current.GuildId}). To move it here, remove the bot from that server first, or change it on the admin page.`);
        }
        const Clear = (Settings) => (Current ? Object.fromEntries(Settings.map((Setting) => [Setting.Type, ''])) : {});
        await this.SaveServer(GuildType, { GuildId, Roles: Clear(ServerType.Roles), Channels: Clear(ServerType.Channels) }, { Source });
        return { Outcome: Current ? 'Moved' : 'Claimed', PreviousName: Current?.Name ?? null };
    }

    async FindServer(GuildId) {
        const Saved = await this.GuildConfigurationRepository.GetConfiguration();
        const Guild = Saved.find((Row) => Row.GuildId === GuildId);
        if (!Guild) {
            return null;
        }
        return { ServerType: RequireServerType(Guild.GuildType), Saved: Guild };
    }

    async SaveServer(GuildType, Body, { Source = 'the admin page' } = {}) {
        const ServerType = RequireServerType(GuildType);
        if (typeof Body !== 'object' || Body === null) {
            throw new ApiError(400, 'INVALID_BODY', 'Request body must be a JSON object.');
        }
        const GuildId = RequireSnowflake(Body.GuildId, 'Server ID');
        const DiscordName = this.Client?.guilds?.cache?.get(GuildId)?.name;
        const Name = (typeof Body.Name === 'string' && Body.Name.trim()) || DiscordName || ServerType.Label;
        if (Name.length > 100) {
            throw new ApiError(400, 'INVALID_NAME', 'The server name must be at most 100 characters.');
        }
        if (Body.EnforceNicknames !== undefined && typeof Body.EnforceNicknames !== 'boolean') {
            throw new ApiError(400, 'INVALID_SETTING', 'EnforceNicknames must be true or false.');
        }
        const Roles = ReadSettings(Body.Roles, ServerType.Roles, 'Roles');
        const Channels = ReadSettings(Body.Channels, ServerType.Channels, 'Channels');
        this.CheckChannelKinds(GuildId, ServerType, Channels);

        try {
            await this.GuildConfigurationRepository.SaveGuild({ GuildType, Name, GuildId, EnforceNicknames: Body.EnforceNicknames, Roles, Channels });
        } catch (SaveError) {
            if (SaveError.code === 'ER_DUP_ENTRY') {
                throw new ApiError(409, 'SERVER_IN_USE', 'That server is already set up as the other server type.');
            }
            throw SaveError;
        }
        this.Logger?.Info(`Server settings saved from ${Source}`, { GuildType, GuildId });
        await this.NotifyChanged();
    }

    async AddExclusion(GuildType, ChannelId) {
        const GuildId = await this.RequireSavedGuildId(GuildType);
        RequireSnowflake(ChannelId, 'Channel ID');
        const Channel = this.Client?.guilds?.cache?.get(GuildId)?.channels?.cache?.get(ChannelId);
        if (Channel && !ExclusionChannelTypes.includes(Channel.type)) {
            throw new ApiError(400, 'INVALID_CHANNEL', 'Pick a text channel, thread, forum or category.');
        }
        const Outcome = await this.GuildConfigurationRepository.AddExcludedChannel(GuildId, ChannelId, null);
        return Outcome === ExclusionOutcomes.Added;
    }

    async RemoveExclusion(GuildType, ChannelId) {
        const GuildId = await this.RequireSavedGuildId(GuildType);
        RequireSnowflake(ChannelId, 'Channel ID');
        return (await this.GuildConfigurationRepository.RemoveExcludedChannel(GuildId, ChannelId)) === ExclusionOutcomes.Removed;
    }

    async RequireSavedGuildId(GuildType) {
        RequireServerType(GuildType);
        const Guild = (await this.GuildConfigurationRepository.GetGuilds()).find((Row) => Row.GuildType === GuildType);
        if (!Guild) {
            throw new ApiError(409, 'SERVER_NOT_SET', 'Save the server first.');
        }
        return Guild.GuildId;
    }

    async NotifyChanged() {
        await Promise.resolve(this.OnConfigurationChanged?.()).catch((ChangeError) => this.Logger?.Warn('Could not refresh after saving settings', { Error: ChangeError }));
    }
}
