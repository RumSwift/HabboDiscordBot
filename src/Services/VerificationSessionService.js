import { IntervalTask } from '../Utils/IntervalTask.js';
import { BuildVerificationExpiredView, BuildVerificationView } from '../Components/VerificationComponents.js';


const SessionIdleLimitMs = 20 * 60 * 1000; // forget abandoned sessions after 20 minutes

export class VerificationSessionService {
    constructor({ VerificationService, Logger, Clock = () => new Date(), CountdownIntervalMs = 10000 }) {
        this.VerificationService = VerificationService;
        this.Logger = Logger;
        this.Clock = Clock;
        this.SessionsByUserId = new Map();
        this.CleanupTimers = new Set();
        this.CountdownTask = new IntervalTask({ Name: 'VerificationCountdown', IntervalMs: CountdownIntervalMs, Task: () => this.TickCountdowns(), Logger });
    }

    Start() {
        this.CountdownTask.Start({ RunImmediately: false });
    }

    async Stop() {
        await this.CountdownTask.Stop();
        for (const Timer of this.CleanupTimers) {
            clearTimeout(Timer);
        }
        this.CleanupTimers.clear();
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

    ScheduleMessageCleanup(Interaction, DelayMs = 5000) {
        const Timer = setTimeout(async () => {
            this.CleanupTimers.delete(Timer);
            try {
                await Interaction.deleteReply();
            } catch {
                // Deleting can fail (e.g. the message is gone). Fall back to a plain message.
                await Interaction.editReply({ content: 'Verification cancelled.', embeds: [], components: [] }).catch((EditError) => {
                    this.Logger?.Debug('Could not clear cancelled verification message', { Error: EditError });
                });
            }
        }, DelayMs);
        Timer.unref?.();
        this.CleanupTimers.add(Timer);
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
            // E.g. the user dismissed the message. Stop redrawing; the DB still enforces expiry.
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
