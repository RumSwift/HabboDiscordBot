import { MessageFlags } from 'discord.js';
import { BuildModPanelResultView } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { EmergencyMuteReason, FormatBanEnd } from '../../Services/Logging/ModActionLogService.js';
import { ClosePanel } from './OpenPanels.js';

export const EmergencyMuteMs = 24 * 60 * 60 * 1000;

// 🔕 Emergency Mute: times the member out for 24 hours without telling them, logs it in Mod Actions and records it in their history.
export async function HandleEmergencyMute(Interaction, Context, { TargetId }) {
    // Muting and logging can take longer than Discord's 3 seconds.
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Emergency Mute Failed', Description, { Success: false }));

    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (!Member) {
        await Fail('This user is no longer in the server.');
        return;
    }
    if (!Member.moderatable) {
        await Fail('I cannot mute this user. They may be an administrator or have a role higher than mine, or I am missing the Timeout Members permission.');
        return;
    }

    const Moderator = Interaction.user;
    try {
        await Member.timeout(EmergencyMuteMs, `Emergency mute (24 hours) by ${Moderator.username}`);
    } catch (MuteError) {
        Context.Logger.Warn('Emergency mute failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: MuteError });
        await Fail('Discord refused the mute. Please try again or contact Habbo Staff.');
        return;
    }
    const EndsTimestamp = new Date(Date.now() + EmergencyMuteMs);

    const LogMessage = await Context.Services.ModActionLogService.LogEmergencyMute({
        GuildId: Interaction.guildId,
        Target: Member.user,
        Moderator,
        DisplayName: Member.displayName,
        EndsTimestamp,
    }).catch((LogError) => {
        Context.Logger.Error('Could not log emergency mute', { Error: LogError });
        return null;
    });
    const LogUrl = LogMessage?.url ?? null;

    await Context.Services.ModSanctionRepository.Add({
        GuildId: Interaction.guildId,
        DiscordUserId: TargetId,
        SanctionType: SanctionTypes.EmergencyMute,
        Punishment: '24 Hours Muted',
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record emergency mute in mod history', { Error: RecordError }));
    Context.Logger.Info('Emergency mute applied', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id });

    await Interaction.editReply(
        BuildModPanelResultView(
            '🚓 Emergency Mute Applied',
            `**${EmergencyMuteReason}**\n\n**Ends:** ${FormatBanEnd(EndsTimestamp)}\nThe user was not notified.${LogUrl ? `\n\n**Log:** ${LogUrl}` : ''}`,
        ),
    );
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
