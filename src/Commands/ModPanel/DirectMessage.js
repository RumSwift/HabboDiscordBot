import { escapeMarkdown, MessageFlags } from 'discord.js';
import { BuildDirectMessageDmView, BuildDirectMessageModal, BuildModPanelResultView, DirectMessageInputId } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { DmsOffNote } from '../../Services/Logging/ModActionLogService.js';
import { ClosePanel } from './OpenPanels.js';

const MaxPreviewLength = 300;

export async function ShowDirectMessageModal(Interaction, Context, { TargetId }) {
    await Interaction.showModal(BuildDirectMessageModal(Interaction.user.id, TargetId));
}

export async function HandleDirectMessageForm(Interaction, Context, { TargetId }) {
    const MessageText = Interaction.fields.getTextInputValue(DirectMessageInputId).trim();
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const Member = await Interaction.guild.members.fetch(TargetId).catch(() => null);
    if (!Member) {
        await Interaction.editReply(BuildModPanelResultView('Direct Message Failed', 'This user is no longer in the server.', { Success: false }));
        return;
    }
    const Guild = await Context.Services.GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId);

    let Delivered = true;
    try {
        await Member.user.send(BuildDirectMessageDmView(TargetId, Guild?.GuildType, MessageText));
    } catch (DmError) {
        Delivered = false;
        Context.Logger.Info('Could not send a Modpanel DM', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: DmError });
    }

    const Moderator = Interaction.user;
    const LogMessage = await Context.Services.ModActionLogService.LogDirectMessage({
        GuildId: Interaction.guildId,
        Target: Member.user,
        Moderator,
        DisplayName: Member.displayName,
        MessageText,
        Delivered,
    }).catch((LogError) => {
        Context.Logger.Error('Could not log Modpanel DM', { Error: LogError });
        return null;
    });
    const LogUrl = LogMessage?.url ?? null;
    Context.Logger.Info('Modpanel DM sent', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Moderator.id, Delivered });

    const Preview = MessageText.length > MaxPreviewLength ? `${MessageText.slice(0, MaxPreviewLength)}…` : MessageText;
    const Lines = [`**Message:** ${escapeMarkdown(Preview)}`];
    if (!Delivered) {
        Lines.push(`⚠️ ${DmsOffNote}`);
    }
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView('📬 Direct Message Sent', Lines.join('\n\n')));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
