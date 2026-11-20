import { IntervalTask } from '../Utils/IntervalTask.js';
import { BuildVerificationExpiredView, BuildVerificationView } from '../Components/VerificationComponents.js';


const SessionIdleLimitMs = 20 * 60 * 1000;

export class VerificationSessionService {
    constructor({ VerificationService, Logger, Clock = () => new Date(), CountdownIntervalMs = 10000 }) {
        this.VerificationService = VerificationService;
        this.Logger = Logger;
        this.Clock = Clock;
        this.SessionsByUserId = new Map();
        this.CountdownTask = new IntervalTask({ Name: 'VerificationCountdown', IntervalMs: CountdownIntervalMs, Task: () => this.TickCountdowns(), Logger });
    }

    Start() {
        this.CountdownTask.Start({ RunImmediately: false });
    }

    async Stop() {
        await this.CountdownTask.Stop();
        this.SessionsByUserId.clear();
    }

    GetSession(DiscordUserId) {
        return this.SessionsByUserId.get(DiscordUserId) ?? null;
    }

    SelectHotel(DiscordUserId, HotelCode) {
        const Session = { DiscordUserId, HotelCode, Challenge: null, Interaction: null, IsChecking: false, LastActivity: this.Clock().getTime() };
        this.SessionsByUserId.set(DiscordUserId, Session);
        return Session;
    }

    AttachChallenge(DiscordUserId, { ChallengeId, VerificationCode, ExpiresTimestamp, HabboUsername, HotelCode }, Interaction) {
        const Session = this.GetSession(DiscordUserId) ?? this.SelectHotel(DiscordUserId, HotelCode);
        Session.HotelCode = HotelCode;
        Session.Challenge = { ChallengeId, VerificationCode, ExpiresTimestamp: new Date(ExpiresTimestamp), HabboUsername, HotelCode };
        Session.Interaction = Interaction;
        Session.IsChecking = false;
        Session.LastActivity = this.Clock().getTime();
        return Session;
    }

    UpdateInteraction(DiscordUserId, Interaction) {
        const Session = this.GetSession(DiscordUserId);
        if (Session) {
            Session.Interaction = Interaction;
            Session.LastActivity = this.Clock().getTime();
        }
    }

    SetChecking(DiscordUserId, IsChecking) {
        const Session = this.GetSession(DiscordUserId);
        if (Session) {
            Session.IsChecking = IsChecking;
        }
    }

    ClearSession(DiscordUserId) {
        this.SessionsByUserId.delete(DiscordUserId);
    }

    async TickCountdowns() {
        const Now = this.Clock();
        const Updates = [];

        for (const Session of this.SessionsByUserId.values()) {
            if (Now.getTime() - Session.LastActivity > SessionIdleLimitMs && !Session.Challenge) {
                this.ClearSession(Session.DiscordUserId);
                continue;
            }
            if (!Session.Challenge || !Session.Interaction || Session.IsChecking) {
                continue;
            }
            Updates.push(this.UpdateCountdown(Session, Now));
        }

        await Promise.allSettled(Updates);
    }

    async UpdateCountdown(Session, Now) {
        const { Challenge, Interaction, DiscordUserId } = Session;

        try {
            if (Challenge.ExpiresTimestamp <= Now) {
                this.ClearSession(DiscordUserId);
                await this.VerificationService.ExpireChallenge(Challenge.ChallengeId);
                await Interaction.editReply(BuildVerificationExpiredView({ OwnerDiscordUserId: DiscordUserId }));
                return;
            }

            Session.PendingEdit = Interaction.editReply(
                BuildVerificationView({
                    OwnerDiscordUserId: DiscordUserId,
                    ChallengeId: Challenge.ChallengeId,
                    VerificationCode: Challenge.VerificationCode,
                    ExpiresTimestamp: Challenge.ExpiresTimestamp,
                    Now,
                    HabboUsername: Challenge.HabboUsername,
                    HotelCode: Challenge.HotelCode,
                    Notice: Session.Notice ?? null,
                }),
            );
            await Session.PendingEdit;
        } catch (UpdateError) {
            this.Logger?.Debug('Countdown update failed; stopping countdown for this session', { DiscordUserId, Error: UpdateError });
            if (this.GetSession(DiscordUserId) === Session) {
                Session.Interaction = null;
            }
        } finally {
            Session.PendingEdit = null;
        }
    }

    async WaitForPendingEdit(DiscordUserId) {
        const PendingEdit = this.GetSession(DiscordUserId)?.PendingEdit;
        if (PendingEdit) {
            await PendingEdit.catch(() => {});
        }
    }
}
