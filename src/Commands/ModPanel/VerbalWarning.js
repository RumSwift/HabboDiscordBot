import { MessageFlags } from 'discord.js';
import { BuildModPanelResultView, BuildVerbalWarningDmView, BuildVerbalWarningModal, ReasonInputs } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { WarningDmsOffNote } from '../../Services/Logging/ModActionLogService.js';
import { ClosePanel } from './OpenPanels.js';

const MaxPreviewLength = 300;

// ⚠️ Verbal Warning (Moderate User menu): asks for the reasons first.
export async function ShowVerbalWarningModal(Interaction, Context, { TargetId }) {
    await Interaction.showModal(BuildVerbalWarningModal(Interaction.user.id, TargetId));
}

// A warned member who is muted (e.g. by an Emergency Mute) has the mute lifted.
// Returns true when lifted, false when it could not be, null when they were not muted.
async function RemoveMute(Member, Moderator, Context) {
    if (!Member.isCommunicationDisabled?.()) {
        return null;
    }
    try {
        await Member.timeout(null, `Mute removed on Verbal Warning by ${Moderator.username}`);
        return true;
    } catch (MuteError) {
        Context.Logger.Warn('Could not remove mute on verbal warning', { GuildId: Member.guild?.id, DiscordUserId: Member.id, Error: MuteError });
        return false;
    }
}

// The form was sent: lift any mute, DM the member, log it in this server's Mod Actions and record it in their history.
export async function HandleVerbalWarningForm(Interaction, Context, { TargetId }) {
    const Field = (Id) => Interaction.fields.getTextInputValue(Id).trim();
    const PrivateReason = Field(ReasonInputs.PrivateReason);
    const PublicReason = Field(ReasonInputs.PublicReason);
    const MessageLink = Field(ReasonInputs.MessageLink);
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (!Member) {
        await Interaction.editReply(BuildModPanelResultView('Verbal Warning Failed', 'This user is no longer in the server.', { Success: false }));
        return;
    }
    const Moderator = Interaction.user;
    const Guild = await Context.Services.GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId);
    const MuteRemoved = await RemoveMute(Member, Moderator, Context);

    // Members with DMs closed still get the warning on record.
    let Delivered = true;
    try {
        await Member.user.send(BuildVerbalWarningDmView(TargetId, Guild?.GuildType, PublicReason));
    } catch (DmError) {
        Delivered = false;
        Context.Logger.Info('Could not DM a verbal warning', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: DmError });
    }

    const LogMessage = await Context.Services.ModActionLogService.LogVerbalWarning({
        GuildId: Interaction.guildId,
        Target: Member.user,
        Moderator,
        DisplayName: Member.displayName,
        PrivateReason,
        PublicReason,
        MessageLink,
        Delivered,
        MuteRemoved,
    }).catch((LogError) => {
        Context.Logger.Error('Could not log verbal warning', { Error: LogError });
        return null;
    });
    const LogUrl = LogMessage?.url ?? null;

    await Context.Services.ModSanctionRepository.Add({
        GuildId: Interaction.guildId,
        DiscordUserId: TargetId,
        SanctionType: SanctionTypes.VerbalWarning,
        PrivateReason,
        PublicReason,
        MessageLink: MessageLink || null,
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record verbal warning in mod history', { Error: RecordError }));
    Context.Logger.Info('Verbal warning applied', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, Delivered, MuteRemoved });

    const Lines = [`**Reason:** ${PrivateReason.length > MaxPreviewLength ? `${PrivateReason.slice(0, MaxPreviewLength)}…` : PrivateReason}`];
    if (MuteRemoved === true) {
        Lines.push('🔊 Their mute was removed.');
    } else if (MuteRemoved === false) {
        Lines.push('⚠️ They are muted, but I could not remove the mute. Please remove it by hand.');
    }
    if (!Delivered) {
        Lines.push(`⚠️ ${WarningDmsOffNote}`);
    }
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView('⚠️ Verbal Warning Applied', Lines.join('\n\n')));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
