import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Games, Hotels } from '../Utils/HotelConfiguration.js';

export class ConfigurationError extends Error {
    constructor(Problems) {
        super(`Invalid configuration:\n  - ${Problems.join('\n  - ')}`);
        this.name = 'ConfigurationError';
        this.Problems = Problems;
    }
}

// Variables whose values are credentials. dotenv silently truncates unquoted
// values at "#", so we check the raw .env text for that mistake.
const CredentialVariables = ['DB_USER', 'DB_PASSWORD', 'DISCORD_TOKEN', 'INTERNAL_API_KEY', 'VERIFICATION_CODE_SECRET'];

const SnowflakePattern = /^\d{17,20}$/;

export function FindUnquotedHashCharacters(RawEnvText) {
    const ProblemVariables = [];
    for (const Line of RawEnvText.split(/\r?\n/)) {
        const Match = Line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!Match || !CredentialVariables.includes(Match[1])) {
            continue;
        }
        const RawValue = Match[2];
        const IsQuoted = /^['"`]/.test(RawValue);
        // A "#" directly attached to other characters is almost certainly part of the value.
        if (!IsQuoted && /[^\s]#/.test(RawValue)) {
            ProblemVariables.push(Match[1]);
        }
    }
    return ProblemVariables;
}

export function LoadEnvironment({ Source, EnvFilePath = path.resolve(process.cwd(), '.env') } = {}) {
    const Problems = [];

    if (!Source) {
        if (existsSync(EnvFilePath)) {
            const RawEnvText = readFileSync(EnvFilePath, 'utf8');
            for (const VariableName of FindUnquotedHashCharacters(RawEnvText)) {
                Problems.push(`${VariableName} contains an unquoted "#". Wrap the value in single quotes, e.g. ${VariableName}='value#here'.`);
            }
            // quiet: do not print dotenv banners. Existing environment variables win over .env.
            dotenv.config({ path: EnvFilePath, quiet: true });
        }
        Source = process.env;
    }

    // Credentials are NOT trimmed: leading/trailing characters may be significant.
    const ReadRaw = (Name) => (Source[Name] === undefined ? '' : String(Source[Name]));
    const ReadTrimmed = (Name) => ReadRaw(Name).trim();

    const Required = (Name, { Trim = true } = {}) => {
        const Value = Trim ? ReadTrimmed(Name) : ReadRaw(Name);
        if (Value === '') {
            Problems.push(`${Name} is required but is missing or empty.`);
        }
        return Value;
    };

    const Integer = (Name, DefaultValue, Minimum, Maximum) => {
        const Raw = ReadTrimmed(Name);
        if (Raw === '') {
            return DefaultValue;
        }
        const Value = Number(Raw);
        if (!Number.isInteger(Value) || Value < Minimum || Value > Maximum) {
            Problems.push(`${Name} must be a whole number between ${Minimum} and ${Maximum}.`);
            return DefaultValue;
        }
        return Value;
    };

    const OptionalBoolean = (Name, DefaultValue) => {
        const Raw = ReadTrimmed(Name).toLowerCase();
        if (Raw === '') {
            return DefaultValue;
        }
        if (['true', '1', 'yes', 'on'].includes(Raw)) {
            return true;
        }
        if (['false', '0', 'no', 'off'].includes(Raw)) {
            return false;
        }
        Problems.push(`${Name} must be true or false.`);
        return DefaultValue;
    };

    const OptionalSnowflake = (Name) => {
        const Value = ReadTrimmed(Name);
        if (Value !== '' && !SnowflakePattern.test(Value)) {
            Problems.push(`${Name} must be a Discord ID (17-20 digits) or left empty.`);
            return '';
        }
        return Value;
    };

    const Database = {
        Host: Required('DB_HOST'),
        Port: Integer('DB_PORT', 3306, 1, 65535),
        User: Required('DB_USER', { Trim: false }),
        Password: Required('DB_PASSWORD', { Trim: false }),
        Name: Required('DB_NAME'),
    };
    if (Database.Name && !/^[A-Za-z0-9_]+$/.test(Database.Name)) {
        Problems.push('DB_NAME may only contain letters, digits and underscores.');
    }

    // Only used once, to fill the Guilds / GuildRoles / GuildLogChannels tables on first start.
    const GuildSeed = [];
    const SeedGuild = (GuildType, Name, GuildIdVariable, LogChannelVariable) => {
        const GuildId = OptionalSnowflake(GuildIdVariable);
        const Roles = Hotels.filter((Hotel) => Hotel.Game === GuildType)
            .map((Hotel) => ({ RoleType: Hotel.RoleType, RoleId: OptionalSnowflake(Hotel.SeedRoleVariable) }))
            .filter((Role) => Role.RoleId);
        const LogChannelId = OptionalSnowflake(LogChannelVariable);
        const LogChannels = LogChannelId ? [{ ChannelType: 'VERIFICATION', ChannelId: LogChannelId }] : [];
        if (GuildId) {
            GuildSeed.push({ GuildType, Name, GuildId, Roles, LogChannels });
        }
    };
    SeedGuild(Games.Habbo, 'Habbo Discord', 'HABBO_GUILD_ID', 'DISCORD_LOG_THREAD_ID');
    SeedGuild(Games.Origins, 'Habbo Origins Discord', 'ORIGINS_GUILD_ID', 'ORIGINS_LOG_CHANNEL_ID');

    const Discord = {
        Token: Required('DISCORD_TOKEN', { Trim: false }),
        ClientId: Required('DISCORD_CLIENT_ID'),
        EnforceNicknames: OptionalBoolean('ENFORCE_NICKNAMES', true),
        NicknameSweepIntervalSeconds: Integer('NICKNAME_SWEEP_INTERVAL_SECONDS', 60, 30, 86400),
    };
    if (Discord.ClientId && !SnowflakePattern.test(Discord.ClientId)) {
        Problems.push('DISCORD_CLIENT_ID must be a Discord application ID (17-20 digits).');
    }

    const Api = {
        Host: ReadTrimmed('API_HOST') || '127.0.0.1',
        Port: Integer('API_PORT', 3000, 1, 65535),
        InternalApiKey: Required('INTERNAL_API_KEY', { Trim: false }),
    };
    if (Api.InternalApiKey && Api.InternalApiKey.length < 32) {
        Problems.push('INTERNAL_API_KEY must be at least 32 characters long. Generate one with crypto.randomBytes(32).');
    }

    const Verification = {
        CodePrefix: ReadRaw('VERIFICATION_CODE_PREFIX') || 'DISC-',
        CodeLength: Integer('VERIFICATION_CODE_LENGTH', 6, 4, 20),
        ExpiryMinutes: Integer('VERIFICATION_EXPIRY_MINUTES', 5, 1, 60),
        MaxAttempts: Integer('VERIFICATION_MAX_ATTEMPTS', 3, 1, 10),
        CodeSecret: Required('VERIFICATION_CODE_SECRET', { Trim: false }),
    };
    if (Verification.CodeSecret && Verification.CodeSecret.length < 32) {
        Problems.push('VERIFICATION_CODE_SECRET must be at least 32 characters long.');
    }
    if (Verification.CodePrefix.length + Verification.CodeLength > 38) {
        // Habbo mottos are limited in length, so keep the code comfortably short.
        Problems.push('VERIFICATION_CODE_PREFIX plus VERIFICATION_CODE_LENGTH must not exceed 38 characters.');
    }

    const HabboApi = {
        TimeoutMs: Integer('HABBO_API_TIMEOUT_MS', 10000, 1000, 60000),
        MaxRetries: Integer('HABBO_API_MAX_RETRIES', 2, 0, 5),
    };

    const LogLevel = (ReadTrimmed('LOG_LEVEL') || 'info').toLowerCase();
    if (!['debug', 'info', 'warn', 'error'].includes(LogLevel)) {
        Problems.push('LOG_LEVEL must be one of: debug, info, warn, error.');
    }

    if (Problems.length > 0) {
        throw new ConfigurationError(Problems);
    }

    return Object.freeze({
        Database: Object.freeze(Database),
        Discord: Object.freeze(Discord),
        GuildSeed: Object.freeze(GuildSeed),
        Api: Object.freeze(Api),
        Verification: Object.freeze(Verification),
        HabboApi: Object.freeze(HabboApi),
        LogLevel,
    });
}

export function GetConfigurationWarnings(Config) {
    const Warnings = [];
    if (!['127.0.0.1', 'localhost', '::1'].includes(Config.Api.Host)) {
        Warnings.push(`Internal API is bound to ${Config.Api.Host}. Remote access must be protected with HTTPS and network restrictions.`);
    }
    return Warnings;
}
