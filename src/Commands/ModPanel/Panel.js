import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Colours, EphemeralView } from '../../Components/ComponentStyles.js';
import { BuildModPanelResultView, BuildModPanelView, ModPanelActions, ModPanelButtons } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { HandleEmergencyMute } from './EmergencyMute.js';

export const ModPanelPermission = PermissionFlagsBits.ManageMessages;

export function HasModPanelPermission(Interaction) {
    return Boolean(Interaction.memberPermissions?.has(ModPanelPermission));
}

export async function RefuseModPanel(Interaction, Title, Description) {
    await Interaction.reply(EphemeralView(BuildModPanelResultView(Title, Description, { Success: false })));
}

// /modpanel <user>: the moderation panel for a member of this server.
export async function ExecuteModPanelCommand(Interaction, Context) {
    if (!HasModPanelPermission(Interaction)) {
        await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this command.');
        return;
    }
    const Target = Interaction.options.getUser('user', true);
    if (Target.bot) {
        await RefuseModPanel(Interaction, 'Not Allowed', 'Bots cannot be moderated with the Modpanel.');
        return;
    }

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { GuildConfigurationRepository, ModSanctionRepository } = Context.Services;
    const [Member, Guild, Sanctions] = await Promise.all([
        Interaction.guild.members.fetch(Target.id).catch(() => null),
        GuildConfigurationRepository.FindGuildByGuildId(Interaction.guildId),
        ModSanctionRepository.GetForUser(Interaction.guildId, Target.id),
    ]);
    if (!Member) {
        await Interaction.editReply(BuildModPanelResultView('User Not Found', `${Target} is not in this server.`, { Success: false }));
        return;
    }
    await Interaction.editReply(BuildModPanelView(Interaction.user.id, Target, Guild?.GuildType, Sanctions));
}

// Panel actions that are not built yet.
async function HandleNotAvailable(Interaction, Context) {
    await Interaction.reply(EphemeralView(BuildModPanelResultView('🚧 Coming Soon', 'This Modpanel action is not available yet.', { Colour: Colours.Neutral })));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

const ButtonHandlers = Object.freeze({
    [ModPanelButtons.EmergencyMute]: HandleEmergencyMute,
});

// Every panel button carries the target's ID and the button's key.
async function HandlePanelButton(Interaction, Context, Parsed) {
    if (!HasModPanelPermission(Interaction)) {
        await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this.');
        return;
    }
    const [TargetId, Key] = Parsed.Arguments;
    await (ButtonHandlers[Key] ?? HandleNotAvailable)(Interaction, Context, { TargetId });
}

async function HandleModerateMenu(Interaction, Context) {
    if (!HasModPanelPermission(Interaction)) {
        await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this.');
        return;
    }
    await HandleNotAvailable(Interaction, Context);
}

export const ModPanelHandlers = Object.freeze({
    [ModPanelActions.Button]: HandlePanelButton,
    [ModPanelActions.Moderate]: HandleModerateMenu,
});
