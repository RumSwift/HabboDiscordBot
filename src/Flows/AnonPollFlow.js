import { randomBytes } from 'node:crypto';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { AnonPollDurations, BuildAnonPollNoticeView, BuildAnonPollResultsView, BuildAnonPollView } from '../Components/AnonPollComponents.js';
import { IsStaff } from '../Utils/StaffAccess.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

export const MaxAnonPollOptions = 6;
const PostPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
const NoMentions = Object.freeze({ parse: [] });

export class AnonPollStore {
    constructor({ Now = () => Date.now(), SetTimer = setTimeout, ClearTimer = clearTimeout } = {}) {
        this.Now = Now;
        this.SetTimer = SetTimer;
        this.ClearTimer = ClearTimer;
        this.Polls = new Map();
    }

    Create({ GuildId, ChannelId, CreatedBy, Question, Options, DurationMs }) {
        const PollId = randomBytes(6).toString('hex');
        const Poll = { PollId, GuildId, ChannelId, CreatedBy, Question, Options, EndsAt: this.Now() + DurationMs, Votes: new Map(), Message: null, Timer: null };
        this.Polls.set(PollId, Poll);
        return Poll;
    }

    Get(PollId) {
        return this.Polls.get(PollId) ?? null;
    }

    Schedule(Poll, OnEnd) {
        Poll.Timer = this.SetTimer(() => OnEnd(Poll), Math.max(0, Poll.EndsAt - this.Now()));
        Poll.Timer?.unref?.();
    }

    Take(PollId) {
        const Poll = this.Get(PollId);
        if (!Poll) {
            return null;
        }
        this.Polls.delete(PollId);
        if (Poll.Timer) {
            this.ClearTimer(Poll.Timer);
        }
        return Poll;
    }
}

export const AnonPolls = new AnonPollStore();

function Notice(Interaction, Context, Title, Description, Options = {}) {
    return Interaction.reply(EphemeralView(BuildAnonPollNoticeView(Title, Description, Options))).then(() => {
        if (Options.SelfDestruct !== false) {
            ScheduleSelfDestruct(Interaction, Context.Logger);
        }
    });
}

export function ReadAnonPollOptions(Interaction) {
    const Options = [];
    for (let Number = 1; Number <= MaxAnonPollOptions; Number += 1) {
        const Option = Interaction.options.getString(`option_${Number}`)?.trim();
        if (Option) {
            Options.push(Option);
        }
    }
    if (Options.length < 2) {
        return { Error: 'A poll needs at least 2 options.' };
    }
    if (new Set(Options.map((Option) => Option.toLowerCase())).size !== Options.length) {
        return { Error: 'Each option must be different.' };
    }
    return { Options };
}

export async function EndAnonPoll(Poll, { Store = AnonPolls, Logger } = {}) {
    if (!Store.Take(Poll.PollId)) {
        return false;
    }
    const Counts = Poll.Options.map(() => 0);
    for (const Index of Poll.Votes.values()) {
        Counts[Index] += 1;
    }
    await Poll.Message?.edit({ ...BuildAnonPollResultsView(Poll, Counts), allowedMentions: NoMentions }).catch((EditError) =>
        Logger?.Warn('Could not show anonymous poll results', { PollId: Poll.PollId, Error: EditError }),
    );
    Logger?.Info('Anonymous poll ended', { PollId: Poll.PollId, GuildId: Poll.GuildId, Votes: Poll.Votes.size });
    return true;
}

export async function ExecuteAnonPollCommand(Interaction, Context, { Store = AnonPolls } = {}) {
    const Channel = Interaction.channel;
    if (!Channel || typeof Channel.send !== 'function' || !Channel.permissionsFor?.(Interaction.guild.members.me)?.has(PostPermissions)) {
        await Notice(Interaction, Context, 'Poll Not Posted', 'The bot cannot send messages in this channel. Check its permissions.', { Success: false });
        return;
    }
    const Read = ReadAnonPollOptions(Interaction);
    if (Read.Error) {
        await Notice(Interaction, Context, 'Poll Not Posted', Read.Error, { Success: false });
        return;
    }
    const Duration = AnonPollDurations[Interaction.options.getString('duration', true)];
    const Poll = Store.Create({
        GuildId: Interaction.guildId,
        ChannelId: Channel.id,
        CreatedBy: Interaction.user.id,
        Question: Interaction.options.getString('question', true).trim(),
        Options: Read.Options,
        DurationMs: Duration.Ms,
    });

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        Poll.Message = await Channel.send({ ...BuildAnonPollView(Poll), allowedMentions: NoMentions });
    } catch (SendError) {
        Store.Take(Poll.PollId);
        throw SendError;
    }
    Store.Schedule(Poll, (Due) => EndAnonPoll(Due, { Store, Logger: Context.Logger }));
    Context.Logger.Info('Anonymous poll started', { PollId: Poll.PollId, GuildId: Poll.GuildId, ChannelId: Poll.ChannelId, StaffDiscordUserId: Interaction.user.id, Duration: Duration.Label });
    await Interaction.editReply(BuildAnonPollNoticeView('Poll Posted', `Your anonymous poll is up and ends in ${Duration.Label}.`));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

export async function HandleAnonPollVote(Interaction, Context, { Arguments: [PollId, IndexText], Store = AnonPolls }) {
    const Poll = Store.Get(PollId);
    const Index = Number(IndexText);
    if (!Poll || !Poll.Options[Index]) {
        await Notice(Interaction, Context, 'Poll Closed', 'This poll has ended.', { Success: false });
        return;
    }
    const Previous = Poll.Votes.get(Interaction.user.id);
    Poll.Votes.set(Interaction.user.id, Index);
    const Choice = `**${Poll.Options[Index]}**`;
    const Text = Previous === undefined ? `You voted for ${Choice}.` : Previous === Index ? `You already voted for ${Choice}.` : `Your vote is now ${Choice}.`;
    await Notice(Interaction, Context, 'Vote Saved', `${Text} Nobody can see who you voted for, and you can change your vote until the poll ends.`);
    if (Previous === undefined) {
        await Poll.Message?.edit({ ...BuildAnonPollView(Poll), allowedMentions: NoMentions }).catch((EditError) =>
            Context.Logger.Debug('Could not update anonymous poll vote count', { PollId, Error: EditError }),
        );
    }
}

export async function HandleAnonPollEnd(Interaction, Context, { Arguments: [PollId], Store = AnonPolls }) {
    const Poll = Store.Get(PollId);
    if (!Poll) {
        await Notice(Interaction, Context, 'Poll Closed', 'This poll has already ended.', { Success: false });
        return;
    }
    if (Interaction.user.id !== Poll.CreatedBy && !(await IsStaff(Interaction, Context.Services.GuildConfigurationRepository))) {
        await Notice(Interaction, Context, 'Not Allowed', 'Only staff can end this poll.', { Success: false });
        return;
    }
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await EndAnonPoll(Poll, { Store, Logger: Context.Logger });
    Context.Logger.Info('Anonymous poll ended early', { PollId, StaffDiscordUserId: Interaction.user.id });
    await Interaction.editReply(BuildAnonPollNoticeView('Poll Ended', 'The results are now showing on the poll.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
