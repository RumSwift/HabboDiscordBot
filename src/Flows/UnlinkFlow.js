import { BuildNoActiveLinkView, BuildUnlinkChoiceView, BuildUnlinkConfirmationView, BuildUnlinkedView } from '../Components/UnlinkComponents.js';
import { LinkOutcomes } from '../Services/HabboLinkService.js';
import { ApplyQueuedDiscordChanges, ScheduleSelfDestruct, ShowLoading } from './FlowHelpers.js';

export async function HandleUnlink(Interaction, Context) {
    await ShowLoading(Interaction, 'Loading...');
    const OwnerDiscordUserId = Interaction.user.id;
    const ActiveLinks = await Context.Services.AuditHistoryService.GetActiveLinksForDiscordUser(OwnerDiscordUserId);
    if (ActiveLinks.length === 0) {
        await Interaction.editReply(BuildNoActiveLinkView({ OwnerDiscordUserId }));
    } else if (ActiveLinks.length === 1) {
        await Interaction.editReply(BuildUnlinkConfirmationView({ OwnerDiscordUserId, ActiveLink: ActiveLinks[0] }));
    } else {
        await Interaction.editReply(BuildUnlinkChoiceView({ OwnerDiscordUserId, ActiveLinks }));
    }
}

export async function HandleUnlinkGame(Interaction, Context, { Arguments }) {
    await ShowLoading(Interaction, 'Loading...');
    const OwnerDiscordUserId = Interaction.user.id;
    const ActiveLink = await Context.Services.AuditHistoryService.GetActiveLinkForDiscordUser(OwnerDiscordUserId, Arguments[0]);
    await Interaction.editReply(ActiveLink ? BuildUnlinkConfirmationView({ OwnerDiscordUserId, ActiveLink }) : BuildNoActiveLinkView({ OwnerDiscordUserId }));
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

    Context.Logger.Info('Habbo account unlinked', { DiscordUserId, Game: Result.Link.Game, LinkId: Result.Link.LinkId, OperationId: Result.OperationId });
    Context.Services.SessionService.ClearSession(DiscordUserId);
    await ApplyQueuedDiscordChanges(Context, DiscordUserId, { UnlinkedLink: Result.Link });
    await Interaction.editReply(BuildUnlinkedView({ OwnerDiscordUserId: DiscordUserId, Game: Result.Link.Game }));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
