import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { BuildAuditPermissionDeniedView } from '../Components/AuditComponents.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { BuildSayFailedView, BuildSaySentView } from '../Components/SayComponents.js';
import { HasAuditPermission } from './AuditFlow.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

const SendPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];

// Typing \n in the message box gives a new line.
export function FormatSayText(Text) {
    return Text.replaceAll('\\n', '\n');
}

// Only users and roles tagged explicitly (<@id>, <@!id>, <@&id>) ping; @everyone and @here never do.
export function BuildSayMentions(Text) {
    const Collect = (Pattern) => [...new Set([...Text.matchAll(Pattern)].map((Match) => Match[1]))].slice(0, 100);
    return { parse: [], users: Collect(/<@!?(\d{17,20})>/g), roles: Collect(/<@&(\d{17,20})>/g) };
}

export async function ExecuteSayCommand(Interaction, Context) {
    if (!HasAuditPermission(Interaction)) {
        await Interaction.reply(EphemeralView(BuildAuditPermissionDeniedView()));
        return;
    }

    const Text = FormatSayText(Interaction.options.getString('message', true));
    const Channel = Interaction.options.getChannel('channel') ?? Interaction.channel;

    // Staff can only post where they could post themselves, and the bot must be able to as well.
    if (!Interaction.member?.permissionsIn?.(Channel)?.has(SendPermissions)) {
        await Interaction.reply(EphemeralView(BuildSayFailedView(Channel, 'You can only use /say in channels where you can send messages yourself.')));
        return;
    }
    if (!Channel?.permissionsFor?.(Interaction.guild.members.me)?.has(SendPermissions) || typeof Channel.send !== 'function') {
        await Interaction.reply(EphemeralView(BuildSayFailedView(Channel, 'The bot cannot send messages there. Check its permissions.')));
        return;
    }

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Sent = await Channel.send({ content: Text, allowedMentions: BuildSayMentions(Text) });
    Context.Logger.Info('Message sent with /say', { StaffDiscordUserId: Interaction.user.id, GuildId: Interaction.guildId, ChannelId: Channel.id, MessageId: Sent.id });

    await Interaction.editReply(BuildSaySentView(Sent));
    ScheduleSelfDestruct(Interaction, Context.Logger);
    await Context.Services.SayLogService?.HandleSay({ Staff: Interaction.user, GuildId: Interaction.guildId, Message: Sent }).catch((LogError) =>
        Context.Logger.Error('Could not log /say', { Error: LogError }),
    );
}
