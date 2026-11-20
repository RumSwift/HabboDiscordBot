import { escapeMarkdown, userMention } from 'discord.js';
import { EphemeralView } from '../../Components/ComponentStyles.js';
import {
    BuildForgiveConfirmView,
    BuildForgiveDmView,
    BuildModPanelResultView,
    NextSanctionText,
    SanctionLabel,
    SanctionMuted,
} from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct, ShowLoading } from '../../Flows/FlowHelpers.js';
import { ClosePanel } from './OpenPanels.js';

export async function ShowForgiveConfirm(Interaction, Context, { TargetId }) {
    const [Target, Sanctions] = await Promise.all([
        Interaction.client.users.fetch(TargetId).catch(() => null),
        Context.Services.ModSanctionRepository.GetForUser(Interaction.guildId, TargetId),
    ]);
    if (!Target) {
        await Interaction.reply(EphemeralView(BuildModPanelResultView('Forgive Failed', 'This user could not be found.', { Success: false })));
        return;
    }
    if (Sanctions.length === 0) {
        await Interaction.reply(EphemeralView(BuildModPanelResultView('Nothing To Forgive', `${userMention(TargetId)} has no sanctions in this server.`, { Success: false })));
        return;
    }
    await Interaction.reply(EphemeralView(BuildForgiveConfirmView(Interaction.user.id, Target, Sanctions[0])));
}

export async function HandleForgiveCancel(Interaction, Context) {
    await Interaction.update(BuildModPanelResultView('❌ Forgive Cancelled', 'Nothing was changed.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

async function RemoveMute(Member, Context, Reason) {
    if (!Member?.isCommunicationDisabled?.()) {
        return null;
    }
    try {
        await Member.timeout(null, Reason);
        return true;
    } catch (MuteError) {
        Context.Logger.Warn('Could not remove mute when forgiving', { DiscordUserId: Member.id, Error: MuteError });
        return false;
    }
}

export async function HandleForgiveConfirm(Interaction, Context, { TargetId, Arguments }) {
    const SanctionId = Arguments[1];
    await ShowLoading(Interaction, 'Forgiving...');
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Forgive Failed', Description, { Success: false }));
    const { GuildConfigurationRepository, ModSanctionRepository, ModActionLogService } = Context.Services;

    const Sanctions = await ModSanctionRepository.GetForUser(Interaction.guildId, TargetId);
    const Sanction = Sanctions[0];
    if (!Sanction || String(Sanction.SanctionId) !== SanctionId) {
        await Fail('Their last sanction has changed since this was opened. Please open the Modpanel again.');
        return;
    }
    const Moderator = Interaction.user;
    const Forgiven = await ModSanctionRepository.Forgive({ GuildId: Interaction.guildId, SanctionId, ModeratorDiscordUserId: Moderator.id }).catch((ForgiveError) => {
        Context.Logger.Error('Could not forgive sanction', { GuildId: Interaction.guildId, SanctionId, Error: ForgiveError });
        return false;
    });
    if (!Forgiven) {
        await Fail('The sanction could not be forgiven. It may already have been. Please try again or contact Habbo Staff.');
        return;
    }

    const [Member, Guild] = await Promise.all([
        Interaction.guild.members.fetch(TargetId).catch(() => null),
        GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId),
    ]);
    const MuteRemoved = SanctionMuted(Sanction) ? await RemoveMute(Member, Context, `Sanction forgiven by ${Moderator.username}`) : null;
    const Target = Member?.user ?? (await Interaction.client.users.fetch(TargetId).catch(() => null));

    let Delivered = false;
    try {
        if (Target) {
            await Target.send(BuildForgiveDmView(TargetId, Guild?.GuildType, MuteRemoved === true));
            Delivered = true;
        }
    } catch (DmError) {
        Context.Logger.Info('Could not DM a forgiveness apology', { DiscordUserId: TargetId, Error: DmError });
    }

    const StillCounted = Sanctions.slice(1).filter((Other) => Other.SanctionType === Sanction.SanctionType).length;
    const NextSanction = NextSanctionText(Sanction.SanctionType, StillCounted);
    const { Emoji, Label } = SanctionLabel(Sanction.SanctionType);
    const LogMessage = Target
        ? await ModActionLogService.LogForgiveness({
              GuildId: Interaction.guildId,
              Target,
              Moderator,
              DisplayName: Member?.displayName ?? Target.username,
              Sanction,
              SanctionLabel: `${Emoji} ${Label}`,
              NextSanction,
              MuteRemoved,
              Delivered,
          }).catch((LogError) => {
              Context.Logger.Error('Could not log forgiveness', { Error: LogError });
              return null;
          })
        : null;
    Context.Logger.Info('Sanction forgiven', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, SanctionId, MuteRemoved, Delivered });

    const Lines = [`**Forgiven:** ${Emoji} ${Label}${Sanction.Punishment ? ` (${escapeMarkdown(Sanction.Punishment)})` : ''}`];
    if (NextSanction) {
        Lines.push(`**Next Sanction Is Now:** ${NextSanction}`);
    }
    if (MuteRemoved === true) {
        Lines.push('🔊 Their mute was removed.');
    } else if (MuteRemoved === false) {
        Lines.push('⚠️ They are muted, but I could not remove the mute.');
    }
    if (!Delivered) {
        Lines.push('⚠️ User has DMs off, so they may not have received the apology.');
    }
    if (LogMessage?.url) {
        Lines.push(`**Log:** ${LogMessage.url}`);
    }
    await Interaction.editReply(BuildModPanelResultView('🕊️ Sanction Forgiven', Lines.join('\n')));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
