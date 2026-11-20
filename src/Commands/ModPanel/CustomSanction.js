import { MessageFlags } from 'discord.js';
import { EphemeralView } from '../../Components/ComponentStyles.js';
import {
    BuildCustomConfirmView,
    BuildCustomSanctionDmView,
    BuildCustomSanctionModal,
    BuildCustomTypeView,
    CustomPunishment,
    CustomSanctionColour,
    CustomSanctionKinds,
    DurationInputId,
    ParseMuteDuration,
} from '../../Components/CustomSanctionComponents.js';
import { BuildModPanelResultView, ReasonInputs } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { SanctionTypes } from '../../Repositories/ModSanctionRepository.js';
import { ClosePanel } from './OpenPanels.js';

const MaxPreviewLength = 300;

const KindRules = Object.freeze({
    [CustomSanctionKinds.Mute]: { Allowed: (Member) => Member.moderatable, Verb: 'mute', Permission: 'Timeout Members' },
    [CustomSanctionKinds.Kick]: { Allowed: (Member) => Member.kickable, Verb: 'kick', Permission: 'Kick Members' },
    [CustomSanctionKinds.Ban]: { Allowed: (Member) => Member.bannable, Verb: 'ban', Permission: 'Ban Members' },
});

export async function ShowCustomTypeMenu(Interaction, Context, { TargetId }) {
    const Target = await Interaction.client.users.fetch(TargetId).catch(() => null);
    if (!Target) {
        await Interaction.reply(EphemeralView(BuildModPanelResultView('Custom Sanction Failed', 'This user could not be found.', { Success: false })));
        return;
    }
    await Interaction.reply(EphemeralView(BuildCustomTypeView(Interaction.user.id, Target)));
}

export async function HandleCustomType(Interaction, Context, { TargetId }) {
    const Kind = Interaction.values?.[0];
    if (!KindRules[Kind]) {
        return;
    }
    if (Kind === CustomSanctionKinds.Mute) {
        await Interaction.showModal(BuildCustomSanctionModal(Interaction.user.id, TargetId, Kind));
        return;
    }
    const Target = await Interaction.client.users.fetch(TargetId).catch(() => null);
    if (!Target) {
        await Interaction.update(BuildModPanelResultView('Custom Sanction Failed', 'This user could not be found.', { Success: false }));
        return;
    }
    await Interaction.update(BuildCustomConfirmView(Interaction.user.id, Target, Kind));
}

export async function HandleCustomConfirm(Interaction, Context, { TargetId, Arguments }) {
    const Kind = Arguments[1];
    if (Kind !== CustomSanctionKinds.Kick && Kind !== CustomSanctionKinds.Ban) {
        return;
    }
    await Interaction.showModal(BuildCustomSanctionModal(Interaction.user.id, TargetId, Kind));
}

export async function HandleCustomCancel(Interaction, Context) {
    await Interaction.update(BuildModPanelResultView('❌ Custom Sanction Cancelled', 'Nothing was changed.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

async function SendDm(Member, Context, ViewData) {
    try {
        await Member.user.send(ViewData);
        return true;
    } catch (DmError) {
        Context.Logger.Info('Could not DM a custom sanction', { DiscordUserId: Member.id, Error: DmError });
        return false;
    }
}

export async function HandleCustomSanctionForm(Interaction, Context, { TargetId, Arguments }) {
    const Kind = Arguments[1];
    const Rules = KindRules[Kind];
    if (!Rules) {
        return;
    }
    const Field = (Id) => Interaction.fields.getTextInputValue(Id).trim();
    const PrivateReason = Field(ReasonInputs.PrivateReason);
    const PublicReason = Field(ReasonInputs.PublicReason);
    const MessageLink = Field(ReasonInputs.MessageLink);
    if (Interaction.isFromMessage?.()) {
        await Interaction.deferUpdate();
    } else {
        await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Custom Sanction Failed', Description, { Success: false }));

    const Duration = Kind === CustomSanctionKinds.Mute ? ParseMuteDuration(Field(DurationInputId)) : null;
    if (Kind === CustomSanctionKinds.Mute && !Duration) {
        await Fail('I could not read that mute length. Use something like **5m** (5 minutes), **3h** (3 hours) or **2d** (2 days), up to **28d**. You can combine them, e.g. **1d12h**.');
        return;
    }
    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (!Member) {
        await Fail('This user is no longer in the server.');
        return;
    }
    if (!Rules.Allowed(Member)) {
        await Fail(`I cannot ${Rules.Verb} this user. They may be an administrator or have a role higher than mine, or I am missing the ${Rules.Permission} permission.`);
        return;
    }

    const { GuildConfigurationRepository, ModSanctionRepository, ModActionLogService } = Context.Services;
    const Guild = await GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId);
    const Moderator = Interaction.user;
    const Punishment = CustomPunishment(Kind, Duration);
    const AuditReason = `Custom sanction (${Punishment}) by ${Moderator.username}`;
    const DmView = BuildCustomSanctionDmView(TargetId, Guild?.GuildType, PublicReason, Kind, Duration);
    const EndsTimestamp = Duration ? new Date(Date.now() + Duration.Ms) : null;
    const Log = (ChannelType, Delivered) =>
        ModActionLogService.LogCustomSanction({
            GuildId: Interaction.guildId,
            ChannelType,
            Target: Member.user,
            Moderator,
            DisplayName: Member.displayName,
            Punishment,
            EndsTimestamp,
            PrivateReason,
            PublicReason,
            MessageLink,
            Delivered,
        }).catch((LogError) => {
            Context.Logger.Error('Could not log custom sanction', { ChannelType, Error: LogError });
            return null;
        });

    let Delivered;
    let LogMessage;
    if (Kind === CustomSanctionKinds.Mute) {
        try {
            await Member.timeout(Duration.Ms, AuditReason);
        } catch (MuteError) {
            Context.Logger.Warn('Custom mute failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: MuteError });
            await Fail('Discord refused the mute. Please try again or contact Habbo Staff.');
            return;
        }
        Delivered = await SendDm(Member, Context, DmView);
        LogMessage = await Log(LogChannelTypes.ModActions, Delivered);
    } else {
        Delivered = await SendDm(Member, Context, DmView);
        const ChannelTypes = Kind === CustomSanctionKinds.Ban ? [LogChannelTypes.BanLog, LogChannelTypes.ModActions] : [LogChannelTypes.ModActions];
        const Posted = await Promise.all(ChannelTypes.map((ChannelType) => Log(ChannelType, Delivered)));
        LogMessage = Posted[Posted.length - 1];
        try {
            await (Kind === CustomSanctionKinds.Ban ? Member.ban({ reason: AuditReason }) : Member.kick(AuditReason));
        } catch (RemovalError) {
            Context.Logger.Warn('Custom removal failed', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Kind, Error: RemovalError });
            await Promise.all(Posted.filter(Boolean).map((Message) => Message.delete().catch(() => {})));
            await Fail(`Discord refused the ${Rules.Verb}. Please try again or contact Habbo Staff.`);
            return;
        }
    }
    const LogUrl = LogMessage?.url ?? null;

    await ModSanctionRepository.Add({
        GuildId: Interaction.guildId,
        DiscordUserId: TargetId,
        SanctionType: SanctionTypes.Custom,
        PrivateReason,
        PublicReason,
        Punishment,
        MessageLink: MessageLink || null,
        SanctionLink: LogUrl,
        ModeratorDiscordUserId: Moderator.id,
    }).catch((RecordError) => Context.Logger.Error('Could not record custom sanction in mod history', { Error: RecordError }));
    Context.Logger.Info('Custom sanction applied', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, Punishment, Delivered });

    const Lines = [`**Sanction:** ${Punishment}`, `**Reason:** ${PrivateReason.length > MaxPreviewLength ? `${PrivateReason.slice(0, MaxPreviewLength)}…` : PrivateReason}`];
    if (!Delivered) {
        Lines.push('⚠️ User has DMs off, so they may not have received it.');
    }
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView('🛠️ Custom Sanction Applied', Lines.join('\n'), { Colour: CustomSanctionColour }));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
