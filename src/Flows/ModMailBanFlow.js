import { escapeMarkdown, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { BanDurations, BuildBanPanelView, BuildBanResultView, BuildExtendPanelView, DescribeDuration, ModMailBanActions } from '../Components/ModMailBanComponents.js';
import { BanOutcomes } from '../Repositories/ModMailBanRepository.js';
import { FormatBanEnd, ModMailBanLogActions } from '../Services/Logging/ModActionLogService.js';
import { CloseModMailForBan } from './ModMailFlow.js';
import { ScheduleSelfDestruct, ShowLoading } from './FlowHelpers.js';

export const ModMailBanPermission = PermissionFlagsBits.ManageMessages;

function HasPermission(Interaction) {
    return Boolean(Interaction.memberPermissions?.has(ModMailBanPermission));
}

async function RejectIfNotPermitted(Interaction) {
    if (HasPermission(Interaction)) {
        return false;
    }
    await Interaction.reply(EphemeralView(BuildBanResultView('No Permission', 'You do not have permission to use this command.', { Success: false })));
    return true;
}

function Log(Context, Interaction, Target, Action, ExpiresTimestamp = null) {
    return Context.Services.ModActionLogService.LogModMailBan({ GuildId: Interaction.guildId, Target, Moderator: Interaction.user, Action, ExpiresTimestamp }).catch((LogError) =>
        Context.Logger.Error('Could not log mod mail ban change', { Action, Error: LogError }),
    );
}

async function Finish(Interaction, Context, ResultView) {
    await Interaction.editReply(ResultView);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

// /modmail ban <user>: shows the member's ban status in this server with the actions that apply.
export async function ExecuteModMailBanCommand(Interaction, Context) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    const Target = Interaction.options.getUser('user', true);
    if (Target.bot) {
        await Interaction.reply(EphemeralView(BuildBanResultView('Not Allowed', 'Bots cannot use mod mail.', { Success: false })));
        return;
    }
    if (Target.id === Interaction.user.id) {
        await Interaction.reply(EphemeralView(BuildBanResultView('Not Allowed', 'You cannot ban yourself from mod mail.', { Success: false })));
        return;
    }
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Ban = await Context.Services.ModMailBanRepository.GetActiveBan(Interaction.guildId, Target.id);
    await Interaction.editReply(BuildBanPanelView(Interaction.user.id, Target, Ban));
}

export async function HandleBanApply(Interaction, Context, { Arguments: [TargetId, DurationKey] }) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    const Duration = BanDurations[DurationKey];
    // Banning closes threads and posts logs, which can take longer than Discord's 3 seconds.
    await ShowLoading(Interaction, 'Banning...');
    const Target = await Interaction.client.users.fetch(TargetId);
    const Name = escapeMarkdown(Target.username);

    const Outcome = await Context.Services.ModMailBanRepository.Ban(Interaction.guildId, TargetId, Interaction.user.id, Duration.Ms);
    if (Outcome === BanOutcomes.NotConfigured) {
        await Interaction.editReply(BuildBanResultView('Not Available', 'Mod mail is not set up for this server.', { Success: false }));
        return;
    }
    if (Outcome === BanOutcomes.AlreadyBanned) {
        // Someone else banned them meanwhile: show the current state instead.
        await Interaction.editReply(BuildBanPanelView(Interaction.user.id, Target, await Context.Services.ModMailBanRepository.GetActiveBan(Interaction.guildId, TargetId)));
        return;
    }

    const Ban = await Context.Services.ModMailBanRepository.GetActiveBan(Interaction.guildId, TargetId);
    const ModeratorName = Interaction.member?.displayName ?? Interaction.user.username;
    const ClosedMail = await CloseModMailForBan(Context, Interaction.client, { GuildId: Interaction.guildId, DiscordUserId: TargetId, ModeratorName }).catch((CloseError) => {
        Context.Logger.Warn("Could not close the banned member's mod mail", { DiscordUserId: TargetId, Error: CloseError });
        return false;
    });
    await Log(Context, Interaction, Target, ModMailBanLogActions.Ban, Ban?.ExpiresTimestamp ?? null);
    Context.Logger.Info('Member banned from mod mail', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Interaction.user.id, Duration: DurationKey });

    await Finish(
        Interaction,
        Context,
        BuildBanResultView(
            '✅ ModMail Ban Applied',
            `${Name} has been banned from using Mod Mail and /dmmod in this server ${DescribeDuration(DurationKey)}.\n\n**Ends:** ${FormatBanEnd(Ban?.ExpiresTimestamp ?? null)}\n\nThey can still contact the other server's moderators.${ClosedMail ? '\n\nTheir open mod mail with this team has been closed.' : ''}`,
        ),
    );
}

export async function HandleBanUnban(Interaction, Context, { Arguments: [TargetId] }) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    await ShowLoading(Interaction, 'Unbanning...');
    const Target = await Interaction.client.users.fetch(TargetId);
    if ((await Context.Services.ModMailBanRepository.Unban(Interaction.guildId, TargetId)) === BanOutcomes.NotBanned) {
        await Interaction.editReply(BuildBanResultView('Not Banned', `${escapeMarkdown(Target.username)} is not banned from mod mail in this server.`, { Success: false }));
        return;
    }
    await Log(Context, Interaction, Target, ModMailBanLogActions.Unban);
    Context.Logger.Info('Member unbanned from mod mail', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Interaction.user.id });
    await Finish(Interaction, Context, BuildBanResultView('✅ ModMail Ban Removed', `${escapeMarkdown(Target.username)} can use Mod Mail and /dmmod in this server again.`));
}

async function LoadTargetAndBan(Interaction, Context, TargetId) {
    return Promise.all([Interaction.client.users.fetch(TargetId), Context.Services.ModMailBanRepository.GetActiveBan(Interaction.guildId, TargetId)]);
}

export async function HandleBanExtendMenu(Interaction, Context, { Arguments: [TargetId] }) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    const [Target, Ban] = await LoadTargetAndBan(Interaction, Context, TargetId);
    // If the ban ended, was removed or made permanent since the panel opened, show the current state instead.
    await Interaction.update(Ban?.ExpiresTimestamp ? BuildExtendPanelView(Interaction.user.id, Target, Ban) : BuildBanPanelView(Interaction.user.id, Target, Ban));
}

export async function HandleBanBack(Interaction, Context, { Arguments: [TargetId] }) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    const [Target, Ban] = await LoadTargetAndBan(Interaction, Context, TargetId);
    await Interaction.update(BuildBanPanelView(Interaction.user.id, Target, Ban));
}

export async function HandleBanExtend(Interaction, Context, { Arguments: [TargetId, DurationKey] }) {
    if (await RejectIfNotPermitted(Interaction)) {
        return;
    }
    await ShowLoading(Interaction, 'Extending...');
    const Target = await Interaction.client.users.fetch(TargetId);
    const { Outcome, ExpiresTimestamp } = await Context.Services.ModMailBanRepository.Extend(Interaction.guildId, TargetId, BanDurations[DurationKey].Ms);
    if (Outcome !== BanOutcomes.Extended) {
        await Interaction.editReply(
            BuildBanResultView(
                'Cannot Extend',
                Outcome === BanOutcomes.NotBanned ? `${escapeMarkdown(Target.username)} is no longer banned. Run /modmail ban again to ban them.` : 'This ban is already permanent.',
                { Success: false },
            ),
        );
        return;
    }
    await Log(Context, Interaction, Target, ModMailBanLogActions.Extend, ExpiresTimestamp);
    Context.Logger.Info('Mod mail ban extended', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Interaction.user.id, Duration: DurationKey });
    await Finish(
        Interaction,
        Context,
        BuildBanResultView('⏳ ModMail Ban Extended', `${escapeMarkdown(Target.username)}'s mod mail ban has been ${DurationKey === 'P' ? 'made permanent' : `extended by ${BanDurations[DurationKey].Label.toLowerCase()}`}.\n\n**Ends:** ${FormatBanEnd(ExpiresTimestamp)}`),
    );
}

export const ModMailBanHandlers = Object.freeze({
    [ModMailBanActions.Apply]: HandleBanApply,
    [ModMailBanActions.Unban]: HandleBanUnban,
    [ModMailBanActions.ExtendMenu]: HandleBanExtendMenu,
    [ModMailBanActions.Extend]: HandleBanExtend,
    [ModMailBanActions.Back]: HandleBanBack,
});
