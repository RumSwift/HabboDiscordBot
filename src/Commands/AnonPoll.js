import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { AnonPollDurations, AnonPollEndAction, AnonPollVoteAction } from '../Components/AnonPollComponents.js';
import { ExecuteAnonPollCommand, HandleAnonPollEnd, HandleAnonPollVote, MaxAnonPollOptions } from '../Flows/AnonPollFlow.js';
import { StaffPermission } from '../Utils/StaffAccess.js';

const Data = new SlashCommandBuilder()
    .setName('anonpoll')
    .setDescription('Staff: post a poll in this channel where votes are anonymous.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(StaffPermission)
    .addStringOption((Option) => Option.setName('question').setDescription('What to ask').setRequired(true).setMaxLength(300))
    .addStringOption((Option) =>
        Option.setName('duration')
            .setDescription('How long the poll stays open')
            .setRequired(true)
            .addChoices(...Object.entries(AnonPollDurations).map(([Key, Duration]) => ({ name: Duration.Label, value: Key }))),
    );
for (let Number = 1; Number <= MaxAnonPollOptions; Number += 1) {
    Data.addStringOption((Option) =>
        Option.setName(`option_${Number}`)
            .setDescription(Number <= 2 ? `Option ${Number}` : `Option ${Number} (optional)`)
            .setRequired(Number <= 2)
            .setMaxLength(80),
    );
}

export default {
    StaffOnly: true,
    Data,
    Execute: ExecuteAnonPollCommand,
    ComponentHandlers: { [AnonPollVoteAction]: HandleAnonPollVote, [AnonPollEndAction]: HandleAnonPollEnd },
};
