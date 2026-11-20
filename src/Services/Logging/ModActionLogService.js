import { AuditLogEvent, escapeMarkdown, time, TimestampStyles, userMention } from 'discord.js';
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

export const ScamBanReason = 'Scam/Phishing';

export function BuildScamBanCard(Target, Moderator, { DisplayName, BannedInName = null, Now = new Date() }) {
    const Action = BannedInName
        ? `${userMention(Target.id)} (${DisplayName}) was banned for Phishing/Scamming in the ${BannedInName} Discord server, so they have also been banned from here.`
        : `${userMention(Target.id)} (${DisplayName}) was banned for Scam/Phishing.`;
    return BuildLogCard({
        Title: BannedInName ? '🚨 Scam/Phishing Ban (Cross-Server) 🚨' : '🚨 Scam/Phishing Ban Applied 🚨',
        User: Target,
        Colour: Colours.Danger,
        Fields: [
            { Label: 'Action', Value: Action },
            { Label: 'Sanction', Value: 'User Banned 🚨' },
            { Label: 'Reason', Value: FormatCodeBlock(ScamBanReason, 100) },
            { Label: 'Message History', Value: 'Deleted (last 7 days)' },
            { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
        ],
        Now,
    });
}

export const DmsOffNote = 'User has DMs off, so they may not have received the message.';

export const WarningDmsOffNote = 'User has DMs off, so they may not have received the warning.';

export function BuildVerbalWarningCard(Target, Moderator, { DisplayName, PrivateReason, PublicReason, MessageLink = '', Delivered, MuteRemoved = null, Now = new Date() }) {
    const Fields = [
        { Label: 'Action', Value: `Official Verbal Warning sent to ${userMention(Target.id)} (${DisplayName})` },
        { Label: 'Reason', Value: FormatCodeBlock(PrivateReason, 1000) },
        { Label: 'Reason Provided To The User', Value: FormatCodeBlock(PublicReason, 1000) },
        { Label: 'Message Link', Value: MessageLink || 'None provided' },
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : `No - ${WarningDmsOffNote}` },
    ];
    if (MuteRemoved !== null) {
        Fields.push({ Label: 'Mute', Value: MuteRemoved ? 'Their mute was removed.' : 'They are muted, but I could not remove the mute.' });
    }
    Fields.push({ Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` });
    return BuildLogCard({ Title: '⚠️ Verbal Warning ⚠️', User: Target, Colour: 3851229, Fields, Now });
}

export function BuildCommunityRulesCard(Target, Moderator, { DisplayName, StrikeNumber, Punishment, EndsTimestamp = null, PrivateReason, PublicReason, MessageLink = '', Delivered, Now = new Date() }) {
    const IsBan = EndsTimestamp === null;
    const Fields = [
        { Label: 'Action', Value: `Community Guidelines Strike #${StrikeNumber} applied to ${userMention(Target.id)} (${DisplayName})` },
        { Label: 'Sanction', Value: `${Punishment} ${IsBan ? '🚨' : '🔇'}` },
    ];
    if (!IsBan) {
        Fields.push({ Label: 'Mute Ends', Value: FormatBanEnd(EndsTimestamp) });
    }
    Fields.push(
        { Label: 'Reason', Value: FormatCodeBlock(PrivateReason, 1000) },
        { Label: 'Reason Provided To The User', Value: FormatCodeBlock(PublicReason, 1000) },
        { Label: 'Message Link', Value: MessageLink || 'None provided' },
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : 'No - User has DMs off, so they may not have received it.' },
        { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
    );
    return BuildLogCard({ Title: IsBan ? '🚨 Sanction Applied: User Banned 🚨' : '⚔️ Sanction Applied ⚔️', User: Target, Colour: IsBan ? 12060423 : 4541125, Fields, Now });
}

export function BuildCustomSanctionCard(Target, Moderator, { DisplayName, Punishment, EndsTimestamp = null, PrivateReason, PublicReason, MessageLink = '', Delivered, Now = new Date() }) {
    const Emoji = EndsTimestamp ? '🔇' : Punishment === 'User Kicked' ? '👢' : '🚨';
    const Fields = [
        { Label: 'Action', Value: `Custom sanction applied to ${userMention(Target.id)} (${DisplayName})` },
        { Label: 'Sanction', Value: `${Punishment} ${Emoji}` },
    ];
    if (EndsTimestamp) {
        Fields.push({ Label: 'Mute Ends', Value: FormatBanEnd(EndsTimestamp) });
    }
    Fields.push(
        { Label: 'Counts Towards', Value: 'Nothing. Custom sanctions are separate from the Community Rules, Racism and Inappropriate Profile steps.' },
        { Label: 'Reason', Value: FormatCodeBlock(PrivateReason, 1000) },
        { Label: 'Reason Provided To The User', Value: FormatCodeBlock(PublicReason, 1000) },
        { Label: 'Message Link', Value: MessageLink || 'None provided' },
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : 'No - User has DMs off, so they may not have received it.' },
        { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
    );
    return BuildLogCard({ Title: '🛠️ Custom Sanction Applied 🛠️', User: Target, Colour: 0x9b59b6, Fields, Now });
}

export function BuildForgivenCard(Target, Moderator, { DisplayName, Sanction, SanctionLabel, NextSanction = null, MuteRemoved = null, Delivered, Now = new Date() }) {
    const Given = time(new Date(Sanction.CreatedTimestamp), TimestampStyles.RelativeTime);
    const Fields = [
        { Label: 'Action', Value: `Last sanction of ${userMention(Target.id)} (${DisplayName}) forgiven and removed from their record` },
        { Label: 'Forgiven Sanction', Value: `${SanctionLabel}${Sanction.Punishment ? ` (${Sanction.Punishment})` : ''}, given ${Given}${Sanction.SanctionLink ? ` - ${Sanction.SanctionLink}` : ''}` },
    ];
    if (NextSanction) {
        Fields.push({ Label: 'Next Sanction Is Now', Value: NextSanction });
    }
    if (MuteRemoved !== null) {
        Fields.push({ Label: 'Mute', Value: MuteRemoved ? 'Their mute was removed.' : 'They are muted, but I could not remove the mute.' });
    }
    Fields.push(
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : 'No - User has DMs off, so they may not have received the apology.' },
        { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
    );
    return BuildLogCard({ Title: '🕊️ Sanction Forgiven 🕊️', User: Target, Colour: Colours.Success, Fields, Now });
}

export function BuildRacismCard(Target, Moderator, { DisplayName, ViolationNumber, Punishment, EndsTimestamp = null, PrivateReason, PublicReason, MessageLink, Delivered, Now = new Date() }) {
    const IsBan = EndsTimestamp === null;
    const Fields = [
        { Label: 'Action', Value: `Racism violation #${ViolationNumber} applied to ${userMention(Target.id)} (${DisplayName})` },
        { Label: 'Sanction', Value: `${Punishment} ${IsBan ? '🚨' : '🔇'}` },
    ];
    if (!IsBan) {
        Fields.push({ Label: 'Mute Ends', Value: FormatBanEnd(EndsTimestamp) });
    }
    Fields.push(
        { Label: 'Reason', Value: FormatCodeBlock(PrivateReason, 1000) },
        { Label: 'Reason Provided To The User', Value: FormatCodeBlock(PublicReason, 1000) },
        { Label: 'Message Link', Value: MessageLink || 'None provided' },
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : 'No - User has DMs off, so they may not have received it.' },
        { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
    );
    return BuildLogCard({ Title: '😡 Racism Violation Applied 😡', User: Target, Colour: 0x8b0000, Fields, Now });
}

export function BuildInappropriateProfileCard(Target, Moderator, { DisplayName, Stage, Reason, PreviousViolations, Delivered, Now = new Date() }) {
    const Titles = { Warning: '💳 Inappropriate Profile Warning 💳', Kick: '💳 Inappropriate Profile Kick 💳', Ban: '💳 Inappropriate Profile Ban 💳' };
    const Fields = [
        { Label: 'Action', Value: `Inappropriate Profile violation #${PreviousViolations + 1} for ${userMention(Target.id)} (${DisplayName})` },
        { Label: 'Sanction', Value: `${Stage.Punishment} ${Stage.Emoji}` },
        { Label: 'Profile Issue', Value: FormatCodeBlock(Reason, 1000) },
    ];
    if (PreviousViolations > 0) {
        Fields.push({ Label: 'Previous Violations', Value: `${PreviousViolations} (earlier warnings not heeded)` });
    }
    Fields.push(
        { Label: 'DM Delivered', Value: Delivered ? 'Yes' : 'No - User has DMs off, so they may not have received it.' },
        { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
    );
    return BuildLogCard({ Title: Titles[Stage.Key], User: Target, Colour: 0xff69b4, Fields, Now });
}

export function BuildNoteCard(Target, { Title, NoteText, MessageLink = null, OriginName, IsGlobal, Author = null, Now = new Date() }) {
    const Fields = [
        { Label: 'Title', Value: escapeMarkdown(Title) },
        { Label: 'Note', Value: FormatCodeBlock(NoteText, 1500) },
    ];
    if (MessageLink) {
        Fields.push({ Label: 'Related Message', Value: MessageLink });
    }
    Fields.push(
        { Label: 'Added In', Value: `${OriginName} Discord server` },
        { Label: 'Visible In', Value: IsGlobal ? 'All servers (global note)' : 'This server only' },
    );
    if (Author) {
        Fields.push({ Label: 'Added By', Value: `${userMention(Author.id)} (${Author.username})` });
    }
    return BuildLogCard({ Title: '📝 User Note Added', User: Target, Colour: 0x98fb98, Fields, Now });
}

export function BuildDirectMessageCard(Target, Moderator, { DisplayName, MessageText, Delivered, Now = new Date() }) {
    return BuildLogCard({
        Title: '📬 Direct Message Sent 📬',
        User: Target,
        Colour: 9779933,
        Fields: [
            { Label: 'Action', Value: `Official Direct Message sent to ${userMention(Target.id)} (${DisplayName})` },
            { Label: 'Message', Value: FormatCodeBlock(MessageText, 3000) },
            { Label: 'DM Delivered', Value: Delivered ? 'Yes' : `No - ${DmsOffNote}` },
            { Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` },
        ],
        Now,
    });
}

export function BuildUserBannedCard(Target, { DisplayName, Moderator = null, Now = new Date() }) {
    const Fields = [{ Label: 'Action', Value: `${userMention(Target.id)} (${DisplayName ?? Target.username}) was banned from the server.` }];
    if (Moderator) {
        Fields.push({ Label: 'Moderator', Value: `${userMention(Moderator.id)} (${Moderator.username})` });
    }
    return BuildLogCard({ Title: '🚨 User Banned 🚨', User: Target, Colour: Colours.Danger, Fields, Now });
}

export function BuildUnbanCard(Target, { Moderator = null, Reason = null, Now = new Date() }) {
    const Fields = [
        { Label: 'Action', Value: `${userMention(Target.id)} (${Target.username}) was unbanned and can join the server again.` },
        { Label: 'Reason', Value: Reason ? FormatCodeBlock(Reason, 1000) : 'None provided' },
        { Label: 'Moderator', Value: Moderator ? `${userMention(Moderator.id)} (${Moderator.username})` : 'Unknown' },
    ];
    return BuildLogCard({ Title: '✅ User Unbanned ✅', User: Target, Colour: Colours.Success, Fields, Now });
}

const UnbanAuditWindowMs = 60 * 1000;

async function FindUnbanEntry(Guild, UserId, Now = Date.now()) {
    try {
        const Logs = await Guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 });
        return Logs.entries.find((Entry) => Entry.targetId === UserId && Now - Entry.createdTimestamp < UnbanAuditWindowMs) ?? null;
    } catch {
        return null;
    }
}

export class ModActionLogService {
    constructor({ GuildLogService, UnbanLookupDelayMs = 2000 }) {
        this.GuildLogService = GuildLogService;
        this.UnbanLookupDelayMs = UnbanLookupDelayMs;
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

    async LogVerbalWarning({ GuildId, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.ModActions,
            SourceChannel: null,
            Build: async () => ({ Card: BuildVerbalWarningCard(Target, Moderator, Details) }),
        });
    }

    async LogCommunityRulesStrike({ GuildId, ChannelType = LogChannelTypes.ModActions, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType,
            SourceChannel: null,
            Build: async () => ({
                Card: ChannelType === LogChannelTypes.BanLog ? BuildUserBannedCard(Target, { DisplayName: Details.DisplayName, Moderator }) : BuildCommunityRulesCard(Target, Moderator, Details),
            }),
        });
    }

    async LogRacism({ GuildId, ChannelType = LogChannelTypes.ModActions, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType,
            SourceChannel: null,
            Build: async () => ({
                Card: ChannelType === LogChannelTypes.BanLog ? BuildUserBannedCard(Target, { DisplayName: Details.DisplayName, Moderator }) : BuildRacismCard(Target, Moderator, Details),
            }),
        });
    }

    async LogInappropriateProfile({ GuildId, ChannelType = LogChannelTypes.ModActions, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType,
            SourceChannel: null,
            Build: async () => ({
                Card: ChannelType === LogChannelTypes.BanLog ? BuildUserBannedCard(Target, { DisplayName: Details.DisplayName, Moderator }) : BuildInappropriateProfileCard(Target, Moderator, Details),
            }),
        });
    }

    async LogNote({ GuildId, Target, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.Notes,
            SourceChannel: null,
            Build: async () => ({ Card: BuildNoteCard(Target, Details) }),
        });
    }

    async LogDirectMessage({ GuildId, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.DirectMessages,
            SourceChannel: null,
            Build: async () => ({ Card: BuildDirectMessageCard(Target, Moderator, Details) }),
        });
    }

    async LogCustomSanction({ GuildId, ChannelType = LogChannelTypes.ModActions, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType,
            SourceChannel: null,
            Build: async () => ({
                Card: ChannelType === LogChannelTypes.BanLog ? BuildUserBannedCard(Target, { DisplayName: Details.DisplayName, Moderator }) : BuildCustomSanctionCard(Target, Moderator, Details),
            }),
        });
    }

    async LogForgiveness({ GuildId, Target, Moderator, ...Details }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType: LogChannelTypes.ModActions,
            SourceChannel: null,
            Build: async () => ({ Card: BuildForgivenCard(Target, Moderator, Details) }),
        });
    }

    async LogUnban(Ban) {
        if (this.UnbanLookupDelayMs > 0) {
            await new Promise((Resolve) => setTimeout(Resolve, this.UnbanLookupDelayMs));
        }
        const Entry = await FindUnbanEntry(Ban.guild, Ban.user.id);
        return this.GuildLogService.Send({
            GuildId: Ban.guild.id,
            ChannelType: LogChannelTypes.BanLog,
            SourceChannel: null,
            Build: async () => ({ Card: BuildUnbanCard(Ban.user, { Moderator: Entry?.executor ?? null, Reason: Entry?.reason ?? null }) }),
        });
    }

    async LogScamBan({ GuildId, ChannelType = LogChannelTypes.ModActions, Target, Moderator, DisplayName, BannedInName = null }) {
        return this.GuildLogService.Send({
            GuildId,
            ChannelType,
            SourceChannel: null,
            Build: async () => ({
                Card:
                    ChannelType === LogChannelTypes.BanLog
                        ? BuildUserBannedCard(Target, { DisplayName, Moderator: BannedInName ? null : Moderator })
                        : BuildScamBanCard(Target, Moderator, { DisplayName, BannedInName }),
            }),
        });
    }
}
