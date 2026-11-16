import { BuildAuditPermissionDeniedView } from '../Components/AuditComponents.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { BuildLogExclusionView } from '../Components/LogExclusionComponents.js';
import { HasAuditPermission } from './AuditFlow.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

export function ExecuteStopLogsCommand(Interaction, Context) {
    return ChangeExclusion(Interaction, Context, true);
}

export function ExecuteStartLogsCommand(Interaction, Context) {
    return ChangeExclusion(Interaction, Context, false);
}

async function ChangeExclusion(Interaction, Context, Exclude) {
    if (!HasAuditPermission(Interaction)) {
        await Interaction.reply(EphemeralView(BuildAuditPermissionDeniedView()));
        return;
    }

    const Channel = Interaction.options.getChannel('channel', true);
    const Repository = Context.Services.GuildConfigurationRepository;
    const Outcome = Exclude
        ? await Repository.AddExcludedChannel(Interaction.guildId, Channel.id, Interaction.user.id)
        : await Repository.RemoveExcludedChannel(Interaction.guildId, Channel.id);

    Context.Logger.Info(Exclude ? 'Channel excluded from logs' : 'Channel included in logs again', {
        StaffDiscordUserId: Interaction.user.id,
        GuildId: Interaction.guildId,
        ChannelId: Channel.id,
        Outcome,
    });
    await Interaction.reply(EphemeralView(BuildLogExclusionView({ Outcome, Channel })));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
