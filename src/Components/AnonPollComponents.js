import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, time, TimestampStyles } from 'discord.js';
import { AnyUser, BuildCustomId } from '../Utils/CustomId.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';

export const AnonPollVoteAction = 'AnonPollVote';
export const AnonPollEndAction = 'AnonPollEnd';

export const AnonPollDurations = Object.freeze({
    '5m': { Label: '5 minutes', Ms: 5 * 60 * 1000 },
    '15m': { Label: '15 minutes', Ms: 15 * 60 * 1000 },
    '30m': { Label: '30 minutes', Ms: 30 * 60 * 1000 },
    '1h': { Label: '1 hour', Ms: 60 * 60 * 1000 },
    '6h': { Label: '6 hours', Ms: 6 * 60 * 60 * 1000 },
    '12h': { Label: '12 hours', Ms: 12 * 60 * 60 * 1000 },
    '1d': { Label: '1 day', Ms: 24 * 60 * 60 * 1000 },
    '3d': { Label: '3 days', Ms: 3 * 24 * 60 * 60 * 1000 },
    '7d': { Label: '7 days', Ms: 7 * 24 * 60 * 60 * 1000 },
});

const Numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

function Bar(Share) {
    const Filled = Math.round(Share * 10);
    return '█'.repeat(Filled) + '░'.repeat(10 - Filled);
}

export function BuildAnonPollView(Poll) {
    const Options = Poll.Options.map((Option, Index) => `${Numbers[Index]} ${Option}`).join('\n');
    const Embed = new EmbedBuilder()
        .setTitle('📊 Anonymous Poll')
        .setDescription(`**${Poll.Question}**\n\n${Options}`)
        .setColor(Colours.Primary)
        .addFields(
            { name: 'Ends', value: `${time(new Date(Poll.EndsAt), TimestampStyles.LongDateTime)} (${time(new Date(Poll.EndsAt), TimestampStyles.RelativeTime)})` },
            { name: 'Votes', value: String(Poll.Votes.size) },
        )
        .setFooter({ text: 'Votes are anonymous: nobody can see who voted for what. Results are shown when the poll ends. Click another option to change your vote.' });

    const Buttons = Poll.Options.map((Option, Index) =>
        new ButtonBuilder()
            .setCustomId(BuildCustomId(AnonPollVoteAction, AnyUser, Poll.PollId, Index))
            .setEmoji(Numbers[Index])
            .setLabel(Option.slice(0, 80))
            .setStyle(ButtonStyle.Secondary),
    );
    Buttons.push(new ButtonBuilder().setCustomId(BuildCustomId(AnonPollEndAction, AnyUser, Poll.PollId)).setLabel('End Poll').setStyle(ButtonStyle.Danger));
    const Rows = [];
    for (let Start = 0; Start < Buttons.length; Start += 5) {
        Rows.push(new ActionRowBuilder().addComponents(Buttons.slice(Start, Start + 5)));
    }
    return View(Embed, Rows);
}

export function BuildAnonPollResultsView(Poll, Counts) {
    const Total = Counts.reduce((Sum, Count) => Sum + Count, 0);
    const Top = Math.max(...Counts);
    const Lines = Poll.Options.map((Option, Index) => {
        const Share = Total ? Counts[Index] / Total : 0;
        const Label = Total && Counts[Index] === Top ? `**${Option}** 🏆` : Option;
        return `${Numbers[Index]} ${Label}\n\`${Bar(Share)}\` ${Counts[Index]} vote${Counts[Index] === 1 ? '' : 's'} (${Math.round(Share * 100)}%)`;
    });
    const Embed = new EmbedBuilder()
        .setTitle('📊 Anonymous Poll: Results')
        .setDescription(`**${Poll.Question}**\n\n${Lines.join('\n\n')}`)
        .setColor(Colours.Success)
        .addFields(
            { name: 'Ended', value: time(new Date(), TimestampStyles.LongDateTime) },
            { name: 'Total votes', value: String(Total) },
        )
        .setFooter({ text: Total ? 'Votes were anonymous.' : 'Nobody voted.' });
    return View(Embed);
}

export function BuildAnonPollNoticeView(Title, Description, { Success = true, SelfDestruct = true } = {}) {
    const Embed = new EmbedBuilder().setTitle(Title).setDescription(Description).setColor(Success ? Colours.Success : Colours.Danger);
    if (SelfDestruct) {
        Embed.setFooter({ text: SelfDestructNote });
    }
    return View(Embed);
}
