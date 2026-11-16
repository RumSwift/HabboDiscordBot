import { time, TimestampStyles, userMention } from 'discord.js';
import { Colours } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatCodeBlock } from './LogCard.js';

export const ModMailBanLogActions = Object.freeze({ Ban: 'BAN', Extend: 'EXTEND', Unban: 'UNBAN' });

export function FormatBanEnd(ExpiresTimestamp) {
    return ExpiresTimestamp ? `${time(ExpiresTimestamp, TimestampStyles.LongDateTime)} (${time(ExpiresTimestamp, TimestampStyles.RelativeTime)})` : 'Never (permanent)';
}

export function BuildModMailBanCard(Target, Moderator, { Action, ExpiresTimestamp = null, Now = new Date() }) {
    const Titles = {
        [ModMailBanLogActions.Ban]: '🚫 Mod Mail Ban Applied',
        [ModMailBanLogActions.Extend]: '⏳ Mod Mail Ban Extended',
        [ModMailBanLogActions.Unban]: '✅ Mod Mail Ban Removed',
    };
    const Fields =
        Action === ModMailBanLogActions.Unban
            ? [{ Label: 'Restriction Lifted', Value: 'Can use Mod Mail and /dmmod to contact the moderators of this server again.' }]
            : [
                  { Label: 'Restriction', Value: 'Banned from using Mod Mail and /dmmod to contact the moderators of this server.' },
                  { Label: 'Ends', Value: FormatBanEnd(ExpiresTimestamp) },
              ];
    Fields.push({ Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` });
    return BuildLogCard({
        Title: Titles[Action],
        User: Target,
        Colour: Action === ModMailBanLogActions.Unban ? Colours.Success : Action === ModMailBanLogActions.Extend ? Colours.Warning : Colours.Danger,
        Fields,
        Now,
    });
}

export const EmergencyMuteReason =
    'The situation is critical. The user has been muted for 24 hours without notification, while we prepare a mod report. This could also be so we can leave the user for staff evaluation';

export function BuildEmergencyMuteCard(Target, Moderator, { DisplayName, EndsTimestamp, Now = new Date() }) {
    return BuildLogCard({
        Title: '🚔 EMERGENCY - Preventive 24h Mute 🚔',
        User: Target,
        Colour: 13961941,
        Fields: [
            { Label: 'Action', Value: `24 Hour Emergency Mute Applied to ${userMention(Target.id)} (${DisplayName})` },
            { Label: 'Reason', Value: FormatCodeBlock(EmergencyMuteReason, 1000) },
            { Label: 'Mute Ends', Value: FormatBanEnd(EndsTimestamp) },
            { Label: 'User Notified', Value: 'No' },
            { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
        ],
        Now,
    });
}

// Posts to the server's general "Mod Actions" thread. Each method returns the posted message, or false.
export class ModActionLogService {
    constructor({ GuildLogService }) {
        this.GuildLogService = GuildLogService;
    }

    async LogModMailBan({ GuildId, Target, Moderator, Action, ExpiresTimestamp = null }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.ModActions,
            SourceChannel: null,
            Build: async () => ({ Card: BuildModMailBanCard(Target, Moderator, { Action, ExpiresTimestamp }) }),
        });
    }

    async LogEmergencyMute({ GuildId, Target, Moderator, DisplayName, EndsTimestamp }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.ModActions,
            SourceChannel: null,
            Build: async () => ({ Card: BuildEmergencyMuteCard(Target, Moderator, { DisplayName, EndsTimestamp }) }),
        });
    }
}
