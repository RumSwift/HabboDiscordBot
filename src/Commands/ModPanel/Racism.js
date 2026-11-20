import { MessageFlags } from 'discord.js';
import { BuildModPanelResultView, BuildRacismDmView, BuildRacismModal, ReasonInputs, TierForRacism } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { ClosePanel } from './OpenPanels.js';

const MaxPreviewLength = 300;

export async function ShowRacismModal(Interaction, Context, { TargetId }) {
    await Interaction.showModal(BuildRacismModal(Interaction.user.id, TargetId));
}

async function SendDm(Member, Context, ViewData) {
    try {
        await Member.user.send(ViewData);
        return true;
    } catch (DmError) {
        Context.Logger.Info('Could not DM a racism violation', { DiscordUserId: Member.id, Error: DmError });
        return false;
    }
}

export async function HandleRacismForm(Interaction, Context, { TargetId }) {
    const Field = (Id) => Interaction.fields.getTextInputValue(Id).trim();
    const PrivateReason = Field(ReasonInputs.PrivateReason);
    const PublicReason = Field(ReasonInputs.PublicReason);
    const MessageLink = Field(ReasonInputs.MessageLink);
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Racism Sanction Failed', Description, { Success: false }));

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
    const PreviousViolations = Sanctions.filter((Sanction) => Sanction.SanctionType === SanctionTypes.Racism).length;
    const ViolationNumber = PreviousViolations + 1;
    const Tier = TierForRacism(PreviousViolations);
    const IsBan = Tier.Ms === null;
    const Punishment = IsBan ? 'User Banned' : `${Tier.Label} Muted`;

    if (IsBan ? !Member.bannable : !Member.moderatable) {
        await Fail(
            `This is racism violation #${ViolationNumber}, which is a **${IsBan ? 'ban' : `${Tier.Label.toLowerCase()} mute`}**, but I cannot ${IsBan ? 'ban' : 'mute'} this user. ` +
                `They may be an administrator or have a role higher than mine, or I am missing the ${IsBan ? 'Ban Members' : 'Timeout Members'} permission.`,
        );
        return;
    }

    const Moderator = Interaction.user;
    const AuditReason = `Racism (violation #${ViolationNumber}) by ${Moderator.username}`;
    const DmView = BuildRacismDmView(TargetId, Guild?.GuildType, PublicReason, Tier);
    const EndsTimestamp = IsBan ? null : new Date(Date.now() + Tier.Ms);
    const Log = (ChannelType, Delivered) =>
        ModActionLogService.LogRacism({
            GuildId: Interaction.guildId,
            ChannelType,
            Target: Member.user,
            Moderator,
            DisplayName: Member.displayName,
            ViolationNumber,
            Punishment,
            EndsTimestamp,
            PrivateReason,
            PublicReason,
            MessageLink,
            Delivered,
        }).catch((LogError) => {
            Context.Logger.Error('Could not log racism violation', { ChannelType, Error: LogError });
            return null;
        });

    let Delivered;
    let LogMessage;
    if (IsBan) {
        Delivered = await SendDm(Member, Context, DmView);
        const [BanLogMessage, ModActionsMessage] = await Promise.all([Log(LogChannelTypes.BanLog, Delivered), Log(LogChannelTypes.ModActions, Delivered)]);
        LogMessage = ModActionsMessage;
        try {
            await Member.ban({ reason: AuditReason });
        } catch (BanError) {
            Context.Logger.Warn('Racism ban failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: BanError });
            await Promise.all([BanLogMessage, ModActionsMessage].filter(Boolean).map((Message) => Message.delete().catch(() => {})));
            await Fail(`This is racism violation #${ViolationNumber}, which is a **ban**, but Discord refused the ban. Please try again or contact Habbo Staff.`);
            return;
        }
    } else {
        try {
            await Member.timeout(Tier.Ms, AuditReason);
        } catch (MuteError) {
            Context.Logger.Warn('Racism mute failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: MuteError });
            await Fail('Discord refused the mute. Please try again or contact Habbo Staff.');
            return;
        }
        Delivered = await SendDm(Member, Context, DmView);
        LogMessage = await Log(LogChannelTypes.ModActions, Delivered);
    }
    const LogUrl = LogMessage?.url ?? null;

    await ModSanctionRepository.Add({
        GuildId: Interaction.guildId,
        DiscordUserId: TargetId,
        SanctionType: SanctionTypes.Racism,
        PrivateReason,
        PublicReason,
        Punishment,
        MessageLink: MessageLink || null,
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record racism violation in mod history', { Error: RecordError }));
    Context.Logger.Info('Racism violation applied', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, ViolationNumber, Punishment, Delivered });

    const Lines = [
        `**Violation:** #${ViolationNumber}`,
        `**Sanction:** ${Punishment} ${IsBan ? '🚨' : '🔇'}`,
        `**Reason:** ${PrivateReason.length > MaxPreviewLength ? `${PrivateReason.slice(0, MaxPreviewLength)}…` : PrivateReason}`,
    ];
    if (!Delivered) {
        Lines.push('⚠️ User has DMs off, so they may not have received it.');
    }
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView('😡 Racism Violation Applied', Lines.join('\n')));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
