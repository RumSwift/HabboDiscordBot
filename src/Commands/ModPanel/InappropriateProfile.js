import { MessageFlags } from 'discord.js';
import { BuildModPanelResultView, BuildProfileDmView, BuildProfileModal, ProfileColour, ProfileReasonInputId, ProfileStageFor } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { ClosePanel } from './OpenPanels.js';

const MaxPreviewLength = 300;

// What each stage needs Discord to allow, and how it is described when it cannot be done.
const StageActions = Object.freeze({
    Kick: { Allowed: (Member) => Member.kickable, Verb: 'kick', Permission: 'Kick Members', Apply: (Member, Reason) => Member.kick(Reason) },
    Ban: { Allowed: (Member) => Member.bannable, Verb: 'ban', Permission: 'Ban Members', Apply: (Member, Reason) => Member.ban({ reason: Reason }) },
});

// 🃏 Inappropriate Profile (Moderate User menu): asks what is wrong with their profile first.
export async function ShowProfileModal(Interaction, Context, { TargetId }) {
    await Interaction.showModal(BuildProfileModal(Interaction.user.id, TargetId));
}

async function SendDm(Member, Context, ViewData) {
    try {
        await Member.user.send(ViewData);
        return true;
    } catch (DmError) {
        Context.Logger.Info('Could not DM an inappropriate profile action', { DiscordUserId: Member.id, Error: DmError });
        return false;
    }
}

// The form was sent. Counting earlier violations in this server: a 24 hour warning, then a kick, then a ban.
// The member is DMed first (they cannot be reached once removed) and it is logged in Mod Actions, plus the ban log for a ban.
export async function HandleProfileForm(Interaction, Context, { TargetId }) {
    const Reason = Interaction.fields.getTextInputValue(ProfileReasonInputId).trim();
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Inappropriate Profile Failed', Description, { Success: false }));

    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (!Member) {
        await Fail('This user is no longer in the server.');
        return;
    }
    const { GuildConfigurationRepository, ModSanctionRepository, ModActionLogService } = Context.Services;
    const [Guild, Sanctions] = await Promise.all([
        GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId),
        ModSanctionRepository.GetForUser(Interaction.guildId, TargetId),
    ]);
    const PreviousViolations = Sanctions.filter((Sanction) => Sanction.SanctionType === SanctionTypes.InappropriateProfile).length;
    const Stage = ProfileStageFor(PreviousViolations);
    const Removal = StageActions[Stage.Key] ?? null;

    if (Removal && !Removal.Allowed(Member)) {
        await Fail(
            `This is violation #${PreviousViolations + 1}, which is a **${Removal.Verb}**, but I cannot ${Removal.Verb} this user. ` +
                `They may be an administrator or have a role higher than mine, or I am missing the ${Removal.Permission} permission.`,
        );
        return;
    }

    const Moderator = Interaction.user;
    const Delivered = await SendDm(Member, Context, BuildProfileDmView(TargetId, Guild?.GuildType, Reason, Stage));
    const Log = (ChannelType) =>
        ModActionLogService.LogInappropriateProfile({
            GuildId: Interaction.guildId,
            ChannelType,
            Target: Member.user,
            Moderator,
            DisplayName: Member.displayName,
            Stage,
            Reason,
            PreviousViolations,
            Delivered,
        }).catch((LogError) => {
            Context.Logger.Error('Could not log inappropriate profile action', { ChannelType, Error: LogError });
            return null;
        });
    // A ban is posted in the ban log as well, before the ban.
    const ChannelTypes = Stage.Key === 'Ban' ? [LogChannelTypes.BanLog, LogChannelTypes.ModActions] : [LogChannelTypes.ModActions];
    const Posted = await Promise.all(ChannelTypes.map(Log));
    const LogMessage = Posted[Posted.length - 1];

    if (Removal) {
        try {
            await Removal.Apply(Member, `Inappropriate Profile (violation #${PreviousViolations + 1}) by ${Moderator.username}`);
        } catch (RemovalError) {
            Context.Logger.Warn('Inappropriate profile removal failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Stage: Stage.Key, Error: RemovalError });
            // The logs said they were removed; take them back down.
            await Promise.all(Posted.filter(Boolean).map((Message) => Message.delete().catch(() => {})));
            await Fail(`This is violation #${PreviousViolations + 1}, which is a **${Removal.Verb}**, but Discord refused it. Please try again or contact Habbo Staff.`);
            return;
        }
    }
    const LogUrl = LogMessage?.url ?? null;

    await ModSanctionRepository.Add({
        GuildId: Interaction.guildId,
        DiscordUserId: TargetId,
        SanctionType: SanctionTypes.InappropriateProfile,
        PrivateReason: Reason,
        PublicReason: Reason,
        Punishment: Stage.Punishment,
        MessageLink: null,
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record inappropriate profile action in mod history', { Error: RecordError }));
    Context.Logger.Info('Inappropriate profile action applied', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, Stage: Stage.Key, Delivered });

    const Lines = [
        `**Violation:** #${PreviousViolations + 1}`,
        `**Sanction:** ${Stage.Punishment} ${Stage.Emoji}`,
        `**Profile Issue:** ${Reason.length > MaxPreviewLength ? `${Reason.slice(0, MaxPreviewLength)}…` : Reason}`,
    ];
    if (!Delivered) {
        Lines.push('⚠️ User has DMs off, so they may not have received it.');
    }
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView(`${Stage.Emoji} Inappropriate Profile Action Applied`, Lines.join('\n'), { Colour: ProfileColour }));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
