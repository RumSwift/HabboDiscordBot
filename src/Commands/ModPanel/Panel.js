import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Colours, EphemeralView } from '../../Components/ComponentStyles.js';
import { BuildModPanelResultView, BuildModPanelView, ModerateOptions, ModPanelActions, ModPanelButtons } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { HandleAddNoteForm, ShowAddNoteModal } from './AddNote.js';
import { HandleCommunityRulesForm, ShowCommunityRulesModal } from './CommunityRules.js';
import { HandleCustomCancel, HandleCustomConfirm, HandleCustomSanctionForm, HandleCustomType, ShowCustomTypeMenu } from './CustomSanction.js';
import { HandleDirectMessageForm, ShowDirectMessageModal } from './DirectMessage.js';
import { HandleEmergencyMute } from './EmergencyMute.js';
import { HandleForgiveCancel, HandleForgiveConfirm, ShowForgiveConfirm } from './Forgive.js';
import { HandleProfileForm, ShowProfileModal } from './InappropriateProfile.js';
import { OpenPanels, PanelKey, TouchPanel } from './OpenPanels.js';
import { HandleRacismForm, ShowRacismModal } from './Racism.js';
import { HandleScamButton, HandleScamCancel, HandleScamConfirm } from './Scam.js';
import { HandleViewNotes } from './ViewNotes.js';
import { HandleVerbalWarningForm, ShowVerbalWarningModal } from './VerbalWarning.js';

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
    OpenPanels.Open(PanelKey(Interaction, Target.id), Interaction, Context.Logger);
}

// Panel actions that are not built yet.
async function HandleNotAvailable(Interaction, Context) {
    await Interaction.reply(EphemeralView(BuildModPanelResultView('🚧 Coming Soon', 'This Modpanel action is not available yet.', { Colour: Colours.Neutral })));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

const ButtonHandlers = Object.freeze({
    [ModPanelButtons.EmergencyMute]: HandleEmergencyMute,
    [ModPanelButtons.Scam]: HandleScamButton,
    [ModPanelButtons.SendDm]: ShowDirectMessageModal,
    [ModPanelButtons.AddNote]: ShowAddNoteModal,
    [ModPanelButtons.ViewNotes]: HandleViewNotes,
});

// Buttons on a panel action's own reply (e.g. the Scam/Phishing "Are you sure?"), carrying the target's ID.
function WithPermission(Handler) {
    return async (Interaction, Context, Parsed) => {
        if (!HasModPanelPermission(Interaction)) {
            await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this.');
            return;
        }
        TouchPanel(Interaction, Parsed.Arguments[0]);
        await Handler(Interaction, Context, { TargetId: Parsed.Arguments[0], Arguments: Parsed.Arguments });
    };
}

// Every panel button carries the target's ID and the button's key.
async function HandlePanelButton(Interaction, Context, Parsed) {
    if (!HasModPanelPermission(Interaction)) {
        await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this.');
        return;
    }
    const [TargetId, Key] = Parsed.Arguments;
    TouchPanel(Interaction, TargetId);
    await (ButtonHandlers[Key] ?? HandleNotAvailable)(Interaction, Context, { TargetId });
}

const ModerateHandlers = Object.freeze({
    [ModerateOptions.VerbalWarning]: ShowVerbalWarningModal,
    [ModerateOptions.Sanction]: ShowCommunityRulesModal,
    [ModerateOptions.Profile]: ShowProfileModal,
    [ModerateOptions.Racism]: ShowRacismModal,
    [ModerateOptions.Forgive]: ShowForgiveConfirm,
    [ModerateOptions.Custom]: ShowCustomTypeMenu,
});

// The "Moderate User" menu carries the target's ID; the chosen option picks the action.
async function HandleModerateMenu(Interaction, Context, Parsed) {
    if (!HasModPanelPermission(Interaction)) {
        await RefuseModPanel(Interaction, 'No Permission', 'You do not have permission to use this.');
        return;
    }
    const [TargetId] = Parsed.Arguments;
    TouchPanel(Interaction, TargetId);
    const Option = Interaction.values?.[0];
    await (ModerateHandlers[Option] ?? HandleNotAvailable)(Interaction, Context, { TargetId });
}

export const ModPanelHandlers = Object.freeze({
    [ModPanelActions.Button]: HandlePanelButton,
    [ModPanelActions.Moderate]: HandleModerateMenu,
    [ModPanelActions.ScamConfirm]: WithPermission(HandleScamConfirm),
    [ModPanelActions.ScamCancel]: WithPermission(HandleScamCancel),
    [ModPanelActions.ForgiveConfirm]: WithPermission(HandleForgiveConfirm),
    [ModPanelActions.ForgiveCancel]: WithPermission(HandleForgiveCancel),
    [ModPanelActions.CustomType]: WithPermission(HandleCustomType),
    [ModPanelActions.CustomConfirm]: WithPermission(HandleCustomConfirm),
    [ModPanelActions.CustomCancel]: WithPermission(HandleCustomCancel),
});

export const ModPanelModalHandlers = Object.freeze({
    [ModPanelActions.DirectMessageForm]: WithPermission(HandleDirectMessageForm),
    [ModPanelActions.VerbalWarningForm]: WithPermission(HandleVerbalWarningForm),
    [ModPanelActions.CommunityRulesForm]: WithPermission(HandleCommunityRulesForm),
    [ModPanelActions.AddNoteForm]: WithPermission(HandleAddNoteForm),
    [ModPanelActions.ProfileForm]: WithPermission(HandleProfileForm),
    [ModPanelActions.RacismForm]: WithPermission(HandleRacismForm),
    [ModPanelActions.CustomForm]: WithPermission(HandleCustomSanctionForm),
});
