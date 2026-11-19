import { escapeMarkdown, userMention } from 'discord.js';
import { EphemeralView } from '../../Components/ComponentStyles.js';
import { BuildModPanelResultView, BuildScamConfirmView, ServerName } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct, ShowLoading } from '../../Flows/FlowHelpers.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { ScamBanReason } from '../../Services/Logging/ModActionLogService.js';
import { ClosePanel } from './OpenPanels.js';

const DeleteMessageSeconds = 7 * 24 * 60 * 60;

// The configured server of the other game (Habbo <-> Origins), or null.
async function FindServers(Context, GuildId) {
    const Guilds = await Context.Services.GuildConfigurationRepository.GetGuilds();
    const Source = Guilds.find((Guild) => Guild.GuildId === GuildId) ?? null;
    const Other = Source ? (Guilds.find((Guild) => Guild.GuildId !== GuildId && Guild.GuildType !== Source.GuildType) ?? null) : null;
    return { Source, Other };
}

// 🐟 Scam/Phishing (Ban): asks the moderator to confirm first.
export async function HandleScamButton(Interaction, Context, { TargetId }) {
    const Target = await Interaction.client.users.fetch(TargetId).catch(() => null);
    if (!Target) {
        await Interaction.reply(EphemeralView(BuildModPanelResultView('Scam/Phishing Ban Failed', 'This user could not be found.', { Success: false })));
        return;
    }
    const { Source, Other } = await FindServers(Context, Interaction.guildId);
    await Interaction.reply(EphemeralView(BuildScamConfirmView(Interaction.user.id, Target, Source?.GuildType, Other?.GuildType ?? null)));
}

export async function HandleScamCancel(Interaction, Context) {
    await Interaction.update(BuildModPanelResultView('❌ Ban Cancelled', 'The Scam/Phishing ban was cancelled. Nobody was banned.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

// Logs the ban in the server's Mod Actions and ban log, then records it in the member's history there.
async function LogAndRecord(Context, { GuildId, Target, Moderator, DisplayName, BannedInName = null }) {
    const Log = (ChannelType) =>
        Context.Services.ModActionLogService.LogScamBan({ GuildId, ChannelType, Target, Moderator, DisplayName, BannedInName }).catch((LogError) => {
            Context.Logger.Error('Could not log scam ban', { GuildId, ChannelType, Error: LogError });
            return null;
        });
    const [ModActionsMessage] = await Promise.all([Log(LogChannelTypes.ModActions), Log(LogChannelTypes.BanLog)]);
    const LogUrl = ModActionsMessage?.url ?? null;

    await Context.Services.ModSanctionRepository.Add({
        GuildId,
        DiscordUserId: Target.id,
        SanctionType: SanctionTypes.Scam,
        PrivateReason: BannedInName ? `${ScamBanReason} (banned in the ${BannedInName} Discord server)` : ScamBanReason,
        PublicReason: ScamBanReason,
        Punishment: 'User Banned',
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record scam ban in mod history', { GuildId, Error: RecordError }));
    return LogUrl;
}

// Bans from the other game's server too. Returns a line for the moderator's reply.
async function BanInOtherServer(Interaction, Context, { Other, SourceName, Target, Moderator }) {
    const OtherName = ServerName(Other.GuildType);
    const Guild = await Interaction.client.guilds.fetch(Other.GuildId).catch(() => null);
    if (!Guild) {
        return `⚠️ **${OtherName}:** not banned, I am not in that server.`;
    }
    const Member = await Guild.members.fetch(Target.id).catch(() => null);
    if (Member && !Member.bannable) {
        return `⚠️ **${OtherName}:** not banned, they may be staff or have a role higher than mine.`;
    }
    try {
        await Guild.bans.create(Target.id, { reason: `${ScamBanReason} - banned in the ${SourceName} Discord by ${Moderator.username}`, deleteMessageSeconds: DeleteMessageSeconds });
    } catch (BanError) {
        Context.Logger.Warn('Cross-server scam ban failed', { GuildId: Other.GuildId, DiscordUserId: Target.id, Error: BanError });
        return `⚠️ **${OtherName}:** Discord refused the ban. Please ban them there by hand.`;
    }
    // No log link: moderators of this server usually cannot see the other server's logs.
    await LogAndRecord(Context, { GuildId: Other.GuildId, Target, Moderator, DisplayName: Member?.displayName ?? Target.username, BannedInName: SourceName });
    return `✅ **${OtherName}:** banned`;
}

// "Yes, Ban User": bans here and in the other game's server, logging in both.
export async function HandleScamConfirm(Interaction, Context, { TargetId }) {
    await ShowLoading(Interaction, 'Banning...');
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Scam/Phishing Ban Failed', Description, { Success: false }));

    const Moderator = Interaction.user;
    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (Member && !Member.bannable) {
        await Fail('I cannot ban this user. They may be an administrator or have a role higher than mine, or I am missing the Ban Members permission.');
        return;
    }
    const Target = Member?.user ?? (await Interaction.client.users.fetch(TargetId).catch(() => null));
    if (!Target) {
        await Fail('This user could not be found.');
        return;
    }

    const { Source, Other } = await FindServers(Context, Interaction.guildId);
    const SourceName = ServerName(Source?.GuildType);
    try {
        await Interaction.guild.bans.create(TargetId, { reason: `${ScamBanReason} - banned by ${Moderator.username}`, deleteMessageSeconds: DeleteMessageSeconds });
    } catch (BanError) {
        Context.Logger.Warn('Scam ban failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: BanError });
        await Fail('Discord refused the ban. Please try again or contact Habbo Staff.');
        return;
    }

    const LogUrl = await LogAndRecord(Context, { GuildId: Interaction.guildId, Target, Moderator, DisplayName: Member?.displayName ?? Target.username });
    const Lines = [`✅ **${SourceName}:** banned${LogUrl ? ` · [Log](${LogUrl})` : ''}`];
    if (Other) {
        Lines.push(await BanInOtherServer(Interaction, Context, { Other, SourceName, Target, Moderator }));
    }
    Context.Logger.Info('Scam/Phishing ban applied', { GuildId: Interaction.guildId, OtherGuildId: Other?.GuildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id });

    await Interaction.editReply(
        BuildModPanelResultView('🚨 Scam/Phishing Ban Applied', `${userMention(Target.id)} (${escapeMarkdown(Target.username)}) has been permanently banned for Scam/Phishing.\nMessages from the last 7 days were deleted.\n\n${Lines.join('\n')}`),
    );
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
