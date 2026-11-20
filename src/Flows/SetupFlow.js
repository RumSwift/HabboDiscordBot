import { channelMention, roleMention } from 'discord.js';
import { ApiError } from '../Api/Middleware/ErrorHandler.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import { BuildSetupDoneView, BuildSetupErrorView, BuildSetupOverviewView } from '../Components/SetupComponents.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

// /setup: the in-Discord way to fill in what the admin page does. It is a staff command (see Utils/StaffAccess.js);
// the shared rules in AdminService do the checking and saving.

const Subcommands = { server: SetupServer, channel: SetupChannel, role: SetupRole, nicknames: SetupNicknames, view: SetupView };

export async function ExecuteSetupCommand(Interaction, Context) {
    const Handler = Subcommands[Interaction.options.getSubcommand()];
    try {
        await Handler(Interaction, Context);
    } catch (SetupError) {
        if (!(SetupError instanceof ApiError)) {
            throw SetupError;
        }
        await Interaction.reply(EphemeralView(BuildSetupErrorView(SetupError.message)));
    }
}

async function Done(Interaction, Context, Title, Description) {
    Context.Logger.Info('Setup changed with /setup', { StaffDiscordUserId: Interaction.user.id, GuildId: Interaction.guildId, Subcommand: Interaction.options.getSubcommand() });
    await Interaction.reply(EphemeralView(BuildSetupDoneView(Title, Description)));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

async function RequireThisServer(Interaction, Context) {
    const Found = await Context.Services.AdminService.FindServer(Interaction.guildId);
    if (!Found) {
        throw new ApiError(409, 'SERVER_NOT_SET', 'This server is not set up yet. Run `/setup server` first.');
    }
    return Found;
}

async function SetupServer(Interaction, Context) {
    const GuildType = Interaction.options.getString('type', true);
    const { Outcome, PreviousName } = await Context.Services.AdminService.ClaimServer(GuildType, Interaction.guildId, { Source: '/setup' });
    const { ServerType } = await RequireThisServer(Interaction, Context);
    const Next = 'Next, set the roles and log channels with `/setup role` and `/setup channel`, then check with `/setup view`.';
    const Text = {
        Unchanged: `This server is already the **${ServerType.Label}**.`,
        Claimed: `This server is now the **${ServerType.Label}**. ${Next}`,
        Moved: `The **${ServerType.Label}** has moved here from ${PreviousName}. Its old roles and channels were cleared. ${Next}`,
    }[Outcome];
    await Done(Interaction, Context, 'Server Set Up', Text);
}

async function SetupChannel(Interaction, Context) {
    const { ServerType, Saved } = await RequireThisServer(Interaction, Context);
    const Type = Interaction.options.getString('log', true);
    const Channel = Interaction.options.getChannel('channel');
    const Setting = ServerType.Channels.find((Candidate) => Candidate.Type === Type);
    if (!Setting) {
        throw new ApiError(400, 'UNKNOWN_SETTING', 'Unknown log.');
    }
    await Context.Services.AdminService.SaveServer(ServerType.GuildType, { GuildId: Saved.GuildId, Channels: { [Type]: Channel?.id ?? '' } }, { Source: '/setup' });
    await Done(Interaction, Context, 'Log Channel Saved', Channel ? `**${Setting.Label}** now goes to ${channelMention(Channel.id)}.` : `**${Setting.Label}** is turned off.`);
}

async function SetupRole(Interaction, Context) {
    const { ServerType, Saved } = await RequireThisServer(Interaction, Context);
    const [GameOrType, MaybeType] = Interaction.options.getString('setting', true).split(':');
    const Type = MaybeType ?? GameOrType;
    const Setting = ServerType.Roles.find((Candidate) => Candidate.Type === Type);
    if (!Setting || (MaybeType && GameOrType !== ServerType.GuildType)) {
        throw new ApiError(400, 'WRONG_SERVER_ROLE', `That role is not used in the **${ServerType.Label}**. Pick one of its own hotels.`);
    }
    const Role = Interaction.options.getRole('role');
    if (Role && (Role.id === Interaction.guildId || Role.managed)) {
        throw new ApiError(400, 'INVALID_ROLE', 'Pick a normal role, not @everyone or a bot role.');
    }
    await Context.Services.AdminService.SaveServer(ServerType.GuildType, { GuildId: Saved.GuildId, Roles: { [Type]: Role?.id ?? '' } }, { Source: '/setup' });
    await Done(Interaction, Context, 'Role Saved', Role ? `**${Setting.Label}** is now ${roleMention(Role.id)}.` : `**${Setting.Label}** is cleared.`);
}

async function SetupNicknames(Interaction, Context) {
    const { ServerType, Saved } = await RequireThisServer(Interaction, Context);
    const Enabled = Interaction.options.getBoolean('enabled', true);
    await Context.Services.AdminService.SaveServer(ServerType.GuildType, { GuildId: Saved.GuildId, EnforceNicknames: Enabled }, { Source: '/setup' });
    await Done(
        Interaction,
        Context,
        'Nicknames Saved',
        Enabled ? 'Verified members are now renamed to "HabboName (HOTEL)" in this server.' : 'The bot now leaves nicknames alone in this server.',
    );
}

async function SetupView(Interaction, Context) {
    await Interaction.reply(EphemeralView(BuildSetupOverviewView(await RequireThisServer(Interaction, Context))));
}
