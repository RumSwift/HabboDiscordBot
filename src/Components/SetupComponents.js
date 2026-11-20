import { channelMention, EmbedBuilder, roleMention } from 'discord.js';
import { ChannelSettings, ServerTypes } from '../Admin/AdminSettings.js';
import { Colours, SelfDestructNote, View } from './ComponentStyles.js';

export const SetupRoleChoices = Object.freeze(
    (() => {
        const Choices = [];
        const Shared = new Set();
        for (const ServerType of ServerTypes) {
            for (const Setting of ServerType.Roles) {
                if (Setting.Group === 'Verified roles') {
                    Choices.push({ name: `Verified: ${Setting.Label}`, value: `${ServerType.GuildType}:${Setting.Type}` });
                } else if (!Shared.has(Setting.Type)) {
                    Shared.add(Setting.Type);
                    Choices.push({ name: Setting.Label, value: Setting.Type });
                }
            }
        }
        return Choices;
    })(),
);

export const SetupChannelChoices = Object.freeze(ChannelSettings.map((Setting) => ({ name: `${Setting.Group}: ${Setting.Label}`, value: Setting.Type })));

export const SetupServerChoices = Object.freeze(ServerTypes.map((ServerType) => ({ name: ServerType.Label, value: ServerType.GuildType })));

export function BuildSetupDoneView(Title, Description) {
    return View(new EmbedBuilder().setTitle(Title).setDescription(Description).setColor(Colours.Success).setFooter({ text: SelfDestructNote }));
}

export function BuildSetupErrorView(Message) {
    return View(new EmbedBuilder().setTitle('Setup').setDescription(Message).setColor(Colours.Danger));
}

export function BuildSetupOverviewView({ ServerType, Saved }) {
    const Line = (Setting, Value) => `${Setting.Label}: ${Value ?? '*not set*'}`;
    const Roles = ServerType.Roles.map((Setting) => Line(Setting, Saved.Roles[Setting.Type] && roleMention(Saved.Roles[Setting.Type])));
    const Groups = new Map();
    for (const Setting of ServerType.Channels) {
        const Value = Saved.Channels[Setting.Type];
        Groups.set(Setting.Group, [...(Groups.get(Setting.Group) ?? []), Line(Setting, Value && channelMention(Value))]);
    }
    const Ignored = Saved.Exclusions.length > 0 ? Saved.Exclusions.map((Exclusion) => channelMention(Exclusion.ChannelId)).join(', ') : 'None';

    const Embed = new EmbedBuilder()
        .setTitle(`Setup: ${ServerType.Label}`)
        .setDescription(`This server is set up as the **${ServerType.Label}**. Change a setting with \`/setup role\`, \`/setup channel\` or \`/setup nicknames\`.`)
        .setColor(Colours.Primary)
        .addFields(
            { name: 'Nicknames', value: Saved.EnforceNicknames ? 'Forced to "HabboName (HOTEL)"' : 'Left alone' },
            { name: 'Roles', value: Roles.join('\n') },
            ...[...Groups].map(([Group, Lines]) => ({ name: Group, value: Lines.join('\n') })),
            { name: 'Channels the logs ignore', value: Ignored.slice(0, 1024) },
        );
    return View(Embed);
}
