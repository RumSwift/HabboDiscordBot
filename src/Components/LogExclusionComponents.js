import { ChannelType, channelMention, EmbedBuilder } from 'discord.js';
import { ExclusionOutcomes } from '../Repositories/GuildConfigurationRepository.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';

const Messages = Object.freeze({
    [ExclusionOutcomes.Added]: { Colour: Colours.Success, Text: (Channel) => `${Channel} is no longer logged.` },
    [ExclusionOutcomes.AlreadyExcluded]: { Colour: Colours.Neutral, Text: (Channel) => `${Channel} is already not logged.` },
    [ExclusionOutcomes.Removed]: { Colour: Colours.Success, Text: (Channel) => `${Channel} is logged again.` },
    [ExclusionOutcomes.NotExcluded]: { Colour: Colours.Neutral, Text: (Channel) => `${Channel} was not excluded, so it is already logged.` },
    [ExclusionOutcomes.NotConfigured]: { Colour: Colours.Danger, Text: () => 'This server is not set up in the Guilds table, so it has no logs.' },
});

export function BuildLogExclusionView({ Outcome, Channel }) {
    const { Colour, Text } = Messages[Outcome];
    let Description = Text(channelMention(Channel.id));
    if (Channel.type === ChannelType.GuildCategory && [ExclusionOutcomes.Added, ExclusionOutcomes.Removed].includes(Outcome)) {
        Description += ' This includes every channel in the category.';
    }
    return View(new EmbedBuilder().setTitle('Logging').setDescription(Description).setColor(Colour).setFooter({ text: SelfDestructNote }));
}
