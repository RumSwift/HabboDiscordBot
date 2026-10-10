import { BuildNoActiveLinkView, BuildUnlinkConfirmationView, BuildUnlinkedView } from '../Components/UnlinkComponents.js';
import { LinkOutcomes } from '../Services/HabboLinkService.js';
import { ApplyQueuedDiscordChanges, ShowLoading } from './FlowHelpers.js';

export async function HandleUnlink(Interaction, Context) {
    await ShowLoading(Interaction, 'Loading...');
    const ActiveLink = await Context.Services.AuditHistoryService.GetActiveLinkForDiscordUser(Interaction.user.id);
    if (!ActiveLink) {
        await Interaction.editReply(BuildNoActiveLinkView({ OwnerDiscordUserId: Interaction.user.id }));
        return;
    }
    await Interaction.editReply(BuildUnlinkConfirmationView({ OwnerDiscordUserId: Interaction.user.id, ActiveLink }));
}

export async function HandleConfirmUnlink(Interaction, Context, { Arguments }) {
    const DiscordUserId = Interaction.user.id;
    const ExpectedLinkId = Arguments[0];

    await ShowLoading(Interaction, 'Unlinking...');

    const Result = await Context.Services.HabboLinkService.UnlinkDiscordUser({ DiscordUserId, ExpectedLinkId, Source: 'DISCORD' });

    if (Result.Outcome !== LinkOutcomes.Unlinked) {
        await Interaction.editReply(BuildNoActiveLinkView({ OwnerDiscordUserId: DiscordUserId }));
        return;
    }

    Context.Logger.Info('Habbo account unlinked', { DiscordUserId, LinkId: Result.Link.LinkId, OperationId: Result.OperationId });
    Context.Services.SessionService.ClearSession(DiscordUserId);
    await ApplyQueuedDiscordChanges(Context, DiscordUserId, { UnlinkedLink: Result.Link });
    await Interaction.editReply(BuildUnlinkedView({ OwnerDiscordUserId: DiscordUserId }));
}
