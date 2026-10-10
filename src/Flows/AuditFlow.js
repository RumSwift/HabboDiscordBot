import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { AuditHistoryPageSize, BuildAuditHistoryView, BuildAuditPermissionDeniedView, BuildAuditSummaryView } from '../Components/AuditComponents.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { ShowLoading } from './FlowHelpers.js';

export const AuditPermission = PermissionFlagsBits.ManageMessages;

export function HasAuditPermission(Interaction) {
    return Boolean(Interaction.memberPermissions?.has(AuditPermission));
}

export async function ExecuteVerifyAuditCommand(Interaction, Context) {
    if (!HasAuditPermission(Interaction)) {
        await Interaction.reply(EphemeralView(BuildAuditPermissionDeniedView()));
        return;
    }

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const TargetUser = Interaction.options.getUser('user', true);
    Context.Logger.Info('Verification audit viewed', { StaffDiscordUserId: Interaction.user.id, TargetDiscordUserId: TargetUser.id });

    await Interaction.editReply(await BuildSummary(Interaction, Context, TargetUser.id, TargetUser.displayAvatarURL?.() ?? null));
}

export async function HandleAuditSummary(Interaction, Context, { Arguments }) {
    if (!(await RejectIfNotPermitted(Interaction))) {
        return;
    }
    await ShowLoading(Interaction, 'Loading...');
    const TargetDiscordUserId = Arguments[0];
    const TargetUser = await Interaction.client?.users.fetch(TargetDiscordUserId).catch(() => null);
    await Interaction.editReply(await BuildSummary(Interaction, Context, TargetDiscordUserId, TargetUser?.displayAvatarURL?.() ?? null));
}

export async function HandleAuditHistory(Interaction, Context, { Arguments }) {
    if (!(await RejectIfNotPermitted(Interaction))) {
        return;
    }
    await ShowLoading(Interaction, 'Loading...');
    const [TargetDiscordUserId, RequestedPage] = Arguments;
    const PageResult = await Context.Services.AuditHistoryService.GetAuditEventPage(TargetDiscordUserId, Number(RequestedPage), AuditHistoryPageSize);
    await Interaction.editReply(
        BuildAuditHistoryView({
            OwnerDiscordUserId: Interaction.user.id,
            TargetDiscordUserId,
            Events: PageResult.Events,
            Page: PageResult.Page,
            TotalPages: PageResult.TotalPages,
        }),
    );
}

async function BuildSummary(Interaction, Context, TargetDiscordUserId, TargetAvatarUrl) {
    const { AuditHistoryService } = Context.Services;
    const [Summary, Accounts] = await Promise.all([
        AuditHistoryService.GetUserLinkSummary(TargetDiscordUserId),
        AuditHistoryService.GetLinkedAccountsForDiscordUser(TargetDiscordUserId),
    ]);
    return BuildAuditSummaryView({ OwnerDiscordUserId: Interaction.user.id, TargetDiscordUserId, TargetAvatarUrl, Accounts, Summary });
}

async function RejectIfNotPermitted(Interaction) {
    if (HasAuditPermission(Interaction)) {
        return true;
    }
    await Interaction.update(BuildAuditPermissionDeniedView());
    return false;
}
