import { BuildDashboardView } from '../Components/DashboardComponents.js';
import { BuildGameSelectionView, BuildHotelSelectionView } from '../Components/HotelSelectionComponents.js';
import { BuildErrorView, Thumbnails } from '../Components/ComponentStyles.js';
import {
    BuildAccountNotFoundView,
    BuildAlreadyLinkedElsewhereView,
    BuildAlreadyLinkedToYouView,
    BuildChallengeClosedView,
    BuildLookupLoadingView,
    BuildRateLimitedView,
    BuildServiceUnavailableView,
    BuildVerificationCancelledView,
    BuildVerificationExpiredView,
    BuildVerificationFailedView,
    BuildVerificationView,
    BuildVerifiedView,
    ExtractVerificationCodeFromMessage,
    FormatAttemptsRemaining,
    MismatchMessage,
} from '../Components/VerificationComponents.js';
import { BuildHabboUsernameModal, UsernameInputId } from '../Modals/HabboUsernameModal.js';
import { VerificationOutcomes } from '../Services/VerificationService.js';
import { IsValidGame, IsValidHotelCode } from '../Utils/HotelConfiguration.js';
import { ApplyQueuedDiscordChanges, ScheduleSelfDestruct, ShowLoading } from './FlowHelpers.js';

export async function ExecuteVerifyHabboCommand(Interaction, Context) {
    const ActiveLinks = await Context.Services.AuditHistoryService.GetActiveLinksForDiscordUser(Interaction.user.id);
    await Interaction.editReply(BuildDashboardView({ OwnerDiscordUserId: Interaction.user.id, ActiveLinks }));
}

export async function HandleDashboard(Interaction, Context) {
    await ShowLoading(Interaction, 'Loading...');
    Context.Services.SessionService.ClearSession(Interaction.user.id);
    const ActiveLinks = await Context.Services.AuditHistoryService.GetActiveLinksForDiscordUser(Interaction.user.id);
    await Interaction.editReply(BuildDashboardView({ OwnerDiscordUserId: Interaction.user.id, ActiveLinks }));
}

export async function HandleLink(Interaction) {
    await Interaction.update(BuildGameSelectionView({ OwnerDiscordUserId: Interaction.user.id }));
}

export async function HandleSelectGame(Interaction, Context, { Arguments }) {
    const Game = Arguments[0];
    if (!IsValidGame(Game)) {
        await Interaction.update(BuildErrorView(Interaction.user.id, 'That game is not supported.'));
        return;
    }
    await ShowLoading(Interaction, 'Loading...');
    const ActiveLink = await Context.Services.AuditHistoryService.GetActiveLinkForDiscordUser(Interaction.user.id, Game);
    await Interaction.editReply(BuildHotelSelectionView({ OwnerDiscordUserId: Interaction.user.id, Game, ActiveLink }));
}

export async function HandleSelectHotel(Interaction, Context, { Arguments }) {
    const HotelCode = Arguments[0];
    if (!IsValidHotelCode(HotelCode)) {
        await Interaction.update(BuildErrorView(Interaction.user.id, 'That hotel is not supported.'));
        return;
    }
    Context.Services.SessionService.SelectHotel(Interaction.user.id, HotelCode);
    await Interaction.showModal(BuildHabboUsernameModal({ OwnerDiscordUserId: Interaction.user.id, HotelCode }));
}

export async function HandleUsernameModal(Interaction, Context, { Arguments }) {
    const HotelCode = Arguments[0];
    const DiscordUserId = Interaction.user.id;
    const Username = Interaction.fields.getTextInputValue(UsernameInputId);
    const { VerificationService, SessionService } = Context.Services;

    if (!IsValidHotelCode(HotelCode)) {
        await Interaction.update(BuildErrorView(DiscordUserId, 'That hotel is not supported.'));
        return;
    }

    await Interaction.update(BuildLookupLoadingView({ HabboUsername: Username.trim(), HotelCode }));

    const Result = await VerificationService.StartChallenge({ DiscordUserId, HotelCode, Username });

    switch (Result.Outcome) {
        case VerificationOutcomes.ChallengeCreated: {
            const { Challenge, VerificationCode } = Result;
            SessionService.AttachChallenge(
                DiscordUserId,
                { ChallengeId: Challenge.ChallengeId, VerificationCode, ExpiresTimestamp: Challenge.ExpiresTimestamp, HabboUsername: Challenge.HabboUsername, HotelCode },
                Interaction,
            );
            await Interaction.editReply(
                BuildVerificationView({
                    OwnerDiscordUserId: DiscordUserId,
                    ChallengeId: Challenge.ChallengeId,
                    VerificationCode,
                    ExpiresTimestamp: Challenge.ExpiresTimestamp,
                    HabboUsername: Challenge.HabboUsername,
                    HotelCode,
                }),
            );
            return;
        }
        case VerificationOutcomes.InvalidUsername:
        case VerificationOutcomes.AccountNotFound:
            await Interaction.editReply(BuildAccountNotFoundView({ OwnerDiscordUserId: DiscordUserId, HotelCode }));
            return;
        case VerificationOutcomes.ServiceUnavailable:
            await Interaction.editReply(BuildServiceUnavailableView({ OwnerDiscordUserId: DiscordUserId, HotelCode, RetryAfterSeconds: Result.RetryAfterSeconds }));
            return;
        case VerificationOutcomes.AlreadyLinkedElsewhere:
            SessionService.ClearSession(DiscordUserId);
            await Interaction.editReply(BuildAlreadyLinkedElsewhereView({ OwnerDiscordUserId: DiscordUserId }));
            return;
        case VerificationOutcomes.AlreadyLinkedToYou:
            SessionService.ClearSession(DiscordUserId);
            await Interaction.editReply(BuildAlreadyLinkedToYouView({ OwnerDiscordUserId: DiscordUserId, HabboUsername: Result.Account.Username, HotelCode }));
            return;
        case VerificationOutcomes.RateLimited:
            await Interaction.editReply(BuildRateLimitedView({ OwnerDiscordUserId: DiscordUserId }));
            return;
        default:
            await Interaction.editReply(BuildErrorView(DiscordUserId));
    }
}

const NoAttemptUsed = 'This did not use up an attempt.';
const CheckNotices = {
    [VerificationOutcomes.ServiceUnavailable]: { Title: 'Habbo Is Not Responding', Message: `We could not reach Habbo to check your motto. ${NoAttemptUsed} Please try again in a moment.` },
    [VerificationOutcomes.AccountNotFound]: { Title: 'Account Not Visible', Message: `Habbo could not find this account just now. Make sure your profile is not private. ${NoAttemptUsed}` },
    [VerificationOutcomes.MottoUnavailable]: { Title: 'Motto Not Visible', Message: `We could not read your motto. Make sure your Habbo profile is visible, then try again. ${NoAttemptUsed}` },
    [VerificationOutcomes.RateLimited]: { Title: 'Slow Down', Message: `You are checking too quickly. Please wait a moment and try again. ${NoAttemptUsed}` },
};

export async function HandleCheckMotto(Interaction, Context, { Arguments }) {
    const ChallengeId = Arguments[0];
    const DiscordUserId = Interaction.user.id;
    const { VerificationService, SessionService } = Context.Services;

    SessionService.SetChecking(DiscordUserId, true);
    await ShowLoading(Interaction, 'Checking motto...');

    let Result;
    try {
        Result = await VerificationService.CheckMotto({ DiscordUserId, ChallengeId });
    } finally {
        SessionService.SetChecking(DiscordUserId, false);
    }

    await SessionService.WaitForPendingEdit(DiscordUserId);

    switch (Result.Outcome) {
        case VerificationOutcomes.Verified:
            SessionService.ClearSession(DiscordUserId);
            await ApplyQueuedDiscordChanges(Context, DiscordUserId);
            await Interaction.editReply(BuildVerifiedView({ HabboUsername: Result.Link.HabboUsername, HotelCode: Result.Link.HotelCode }));
            ScheduleSelfDestruct(Interaction, Context.Logger);
            return;

        case VerificationOutcomes.Mismatch:
            await ShowVerificationScreen(Interaction, Context, Result.Challenge, {
                Title: 'Motto Does Not Match',
                Message: `${MismatchMessage}\n\n${FormatAttemptsRemaining(Result.RemainingAttempts)}`,
                Thumbnail: Thumbnails.MottoMismatch,
            });
            return;

        case VerificationOutcomes.ServiceUnavailable:
        case VerificationOutcomes.AccountNotFound:
        case VerificationOutcomes.MottoUnavailable:
        case VerificationOutcomes.RateLimited:
            await ShowVerificationScreen(Interaction, Context, Result.Challenge, CheckNotices[Result.Outcome]);
            return;

        case VerificationOutcomes.CheckInProgress:
            return;

        case VerificationOutcomes.Failed:
            ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId);
            await Interaction.editReply(BuildVerificationFailedView({ OwnerDiscordUserId: DiscordUserId }));
            return;

        case VerificationOutcomes.Expired:
            ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId);
            await Interaction.editReply(BuildVerificationExpiredView({ OwnerDiscordUserId: DiscordUserId }));
            return;

        case VerificationOutcomes.AlreadyLinkedElsewhere:
            ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId);
            await Interaction.editReply(BuildAlreadyLinkedElsewhereView({ OwnerDiscordUserId: DiscordUserId }));
            return;

        case VerificationOutcomes.ChallengeClosed:
            ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId);
            if (Result.Status === 'COMPLETED') {
                await Interaction.editReply(BuildVerifiedView({ HabboUsername: Result.Challenge.HabboUsername, HotelCode: Result.Challenge.HotelCode }));
                ScheduleSelfDestruct(Interaction, Context.Logger);
            } else {
                await Interaction.editReply(BuildChallengeClosedView({ OwnerDiscordUserId: DiscordUserId }));
            }
            return;

        default:
            ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId);
            await Interaction.editReply(BuildChallengeClosedView({ OwnerDiscordUserId: DiscordUserId }));
    }
}

export async function HandleCancel(Interaction, Context, { Arguments }) {
    const DiscordUserId = Interaction.user.id;
    const ChallengeId = Arguments[0] ?? null;
    const { VerificationService, SessionService } = Context.Services;

    await ShowLoading(Interaction, 'Cancelling...');
    SessionService.ClearSession(DiscordUserId);
    await VerificationService.CancelChallenge({ DiscordUserId, ChallengeId });

    await Interaction.editReply(BuildVerificationCancelledView());
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

async function ShowVerificationScreen(Interaction, Context, Challenge, Notice) {
    const DiscordUserId = Interaction.user.id;
    const { SessionService } = Context.Services;

    const Session = SessionService.GetSession(DiscordUserId);
    const RememberedCode = Session?.Challenge?.ChallengeId === Challenge.ChallengeId ? Session.Challenge.VerificationCode : null;
    const VerificationCode = RememberedCode ?? ExtractVerificationCodeFromMessage(Interaction.message) ?? '(see the code shown earlier)';

    const UpdatedSession = SessionService.AttachChallenge(
        DiscordUserId,
        { ChallengeId: Challenge.ChallengeId, VerificationCode, ExpiresTimestamp: Challenge.ExpiresTimestamp, HabboUsername: Challenge.HabboUsername, HotelCode: Challenge.HotelCode },
        Interaction,
    );
    UpdatedSession.Notice = Notice;

    await Interaction.editReply(
        BuildVerificationView({
            OwnerDiscordUserId: DiscordUserId,
            ChallengeId: Challenge.ChallengeId,
            VerificationCode,
            ExpiresTimestamp: Challenge.ExpiresTimestamp,
            HabboUsername: Challenge.HabboUsername,
            HotelCode: Challenge.HotelCode,
            Notice,
        }),
    );
}

function ClearSessionIfCurrent(SessionService, DiscordUserId, ChallengeId) {
    const Session = SessionService.GetSession(DiscordUserId);
    if (!Session?.Challenge || Session.Challenge.ChallengeId === ChallengeId) {
        SessionService.ClearSession(DiscordUserId);
    }
}
