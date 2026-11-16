import { AttachmentBuilder } from 'discord.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import {
    BuildAlreadyOpenView,
    BuildModMailClosedDmView,
    BuildModMailConfirmView,
    BuildModMailModal,
    BuildModMailOpenedView,
    BuildModMailPassedDmView,
    BuildModMailResultView,
    BuildModMailThreadCard,
    BuildModMailUnavailableView,
    BuildModReplyDmView,
    BuildModMailRestrictedView,
    BuildTeamRestrictedView,
    BuildOpenModMailPromptView,
    BuildTeamSelectView,
    FormatNotForwarded,
    ModMailActions,
    ModMailInquiryInputId,
    ModMailTitleInputId,
    ReplyNotDeliveredNote,
    TeamName,
} from '../Components/ModMailComponents.js';
import { DmModPingRoleType, LogChannelTypes } from '../Repositories/GuildConfigurationRepository.js';
import { SaveAttachments } from '../Services/Logging/MessageDeleteLogService.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { ScheduleSelfDestruct, ShowLoading } from './FlowHelpers.js';

const MaxMessageLength = 2000; // Discord limit
const MaxThreadNameLength = 100; // Discord limit
// The smallest upload limit (DMs and unboosted servers); used both ways so a file never makes the whole message fail.
const ForwardLimitBytes = 10 * 1024 * 1024;

// Every server with a mod mail forum: [{ GuildId, GuildType, ChannelId }].
function GetTeams(Context) {
    return Context.Services.GuildConfigurationRepository.GetLogChannels(LogChannelTypes.ModMailForum);
}

async function GetOtherTeam(Context, GuildId) {
    return (await GetTeams(Context)).find((Team) => Team.GuildId !== GuildId) ?? null;
}

// The teams a member may contact: bans are per server, so a ban by one team leaves the other open.
async function GetAllowedTeams(Context, DiscordUserId) {
    const [Teams, Banned] = await Promise.all([GetTeams(Context), Context.Services.ModMailBanRepository.GetBannedGuildIds(DiscordUserId)]);
    return { Teams, Allowed: Teams.filter((Team) => !Banned.has(Team.GuildId)) };
}

async function FetchChannel(Client, ChannelId) {
    return ChannelId ? Client.channels.fetch(ChannelId).catch(() => null) : null;
}

// Everything the thread card needs besides the mail itself.
async function BuildThreadCard(Context, Client, ModMail) {
    const { GuildConfigurationRepository, ModMailRepository } = Context.Services;
    const [User, PingRoleId, OtherTeam, PassedFrom] = await Promise.all([
        Client.users.fetch(ModMail.DiscordUserId),
        GuildConfigurationRepository.GetRoleId(ModMail.GuildId, DmModPingRoleType),
        GetOtherTeam(Context, ModMail.GuildId),
        ModMail.PassedFromModMailId ? ModMailRepository.FindById(ModMail.PassedFromModMailId) : null,
    ]);
    return BuildModMailThreadCard(ModMail, User, { PingRoleId, PassedFromGuildType: PassedFrom?.GuildType ?? null, OtherTeamGuildType: OtherTeam?.GuildType ?? null });
}

async function RefreshThreadCard(Context, Client, ModMailId) {
    try {
        const ModMail = await Context.Services.ModMailRepository.FindById(ModMailId);
        const Thread = await FetchChannel(Client, ModMail.ThreadId);
        const Starter = await Thread.fetchStarterMessage();
        await Starter.edit(await BuildThreadCard(Context, Client, ModMail));
    } catch (EditError) {
        Context.Logger.Warn('Could not update the mod mail thread card', { ModMailId, Error: EditError });
    }
}

// Creates the mail's thread in its team's forum and stores the thread ID. Deletes the mail row if it fails.
async function CreateThreadForMail(Context, Client, ModMailId) {
    const { ModMailRepository } = Context.Services;
    try {
        const ModMail = await ModMailRepository.FindById(ModMailId);
        const Forum = await FetchChannel(Client, ModMail.ForumChannelId);
        const User = await Client.users.fetch(ModMail.DiscordUserId);
        const Thread = await Forum.threads.create({
            name: `${ModMail.Title} - ${User.username}`.slice(0, MaxThreadNameLength),
            message: await BuildThreadCard(Context, Client, ModMail),
        });
        await ModMailRepository.SetThreadId(ModMailId, Thread.id);
        return { ...ModMail, ThreadId: Thread.id };
    } catch (CreateError) {
        await ModMailRepository.Delete(ModMailId);
        Context.Logger.Error('Could not create a mod mail thread', { ModMailId, Error: CreateError });
        return null;
    }
}

// Downloads a message's files so they can be re-uploaded elsewhere (screenshots, videos, documents).
async function CollectFiles(Message, Context) {
    if (!Message.attachments?.size) {
        return { Saved: [], Uploads: [], NotForwarded: [] };
    }
    const Saved = await SaveAttachments(Message, { Fetch: Context.Fetch ?? fetch, LimitBytes: ForwardLimitBytes });
    const Kept = Saved.filter((File) => File.Buffer);
    return {
        Saved: Kept,
        Uploads: Kept.map((File) => new AttachmentBuilder(File.Buffer, { name: File.FileName })),
        NotForwarded: Saved.filter((File) => !File.Buffer),
    };
}

function HasSomethingToSend(Message) {
    return Boolean(Message.content) || Message.attachments?.size > 0;
}

// A member wrote to the bot in DMs: add it to their open mail, or offer to open one.
export async function HandleModMailDirectMessage(Message, Context) {
    if (Message.author.bot || Message.guildId || !HasSomethingToSend(Message)) {
        return;
    }
    const { ModMailRepository } = Context.Services;
    const Open = await ModMailRepository.FindOpenByUser(Message.author.id);

    if (Open) {
        const Thread = await FetchChannel(Message.client, Open.ThreadId);
        if (Thread && !Thread.locked) {
            const { Uploads, NotForwarded } = await CollectFiles(Message, Context);
            let Text = Message.content ? `**${Message.author.username}**: ${Message.content}` : `**${Message.author.username}** sent:`;
            if (NotForwarded.length > 0) {
                Text = `${Text}\n-# ⚠️ Could not forward:\n${FormatNotForwarded(NotForwarded)}`;
            }
            await Thread.send({ content: Text.slice(0, MaxMessageLength), files: Uploads, allowedMentions: { parse: [] } });
            await ModMailRepository.TouchActivity(Open.ModMailId);
            if (NotForwarded.length > 0) {
                await Message.reply({
                    content: `⚠️ Some files could not be sent to the moderation team:\n${FormatNotForwarded(NotForwarded)}\nTry a smaller file or a screenshot.`,
                    allowedMentions: { parse: [] },
                }).catch(() => {});
            }
            return;
        }
        // The thread was deleted or locked by hand: treat the mail as closed.
        await ModMailRepository.Close(Open.ModMailId, null);
        Context.Logger.Warn('Closed a mod mail whose thread is gone or locked', { ModMailId: Open.ModMailId, ThreadId: Open.ThreadId });
    }

    const { Teams, Allowed } = await GetAllowedTeams(Context, Message.author.id);
    const BotAvatarUrl = Message.client.user?.displayAvatarURL?.();
    if (Teams.length > 0 && Allowed.length === 0) {
        await Message.author.send(BuildModMailRestrictedView(Message.author, BotAvatarUrl));
        return;
    }
    await Message.author.send(BuildOpenModMailPromptView(Message.author, BotAvatarUrl));
}

// A moderator wrote in a mod mail thread: send it to the member anonymously.
export async function HandleModMailThreadMessage(Message, Context) {
    if (Message.author.bot || !Message.guildId || !Message.channel?.isThread?.() || !HasSomethingToSend(Message)) {
        return;
    }
    const { ModMailRepository } = Context.Services;
    const ModMail = await ModMailRepository.FindOpenByThreadId(Message.channel.id);
    if (!ModMail) {
        return;
    }

    const { Saved, Uploads, NotForwarded } = await CollectFiles(Message, Context);
    let Delivered = true;
    try {
        const User = await Message.client.users.fetch(ModMail.DiscordUserId);
        await User.send({ ...BuildModReplyDmView(Message.content, ModMail.GuildType, Saved), files: Uploads });
    } catch (DmError) {
        Delivered = false;
        Context.Logger.Warn('Could not DM a mod mail reply', { ModMailId: ModMail.ModMailId, Error: DmError });
    }
    const IsFirstReply = await ModMailRepository.MarkModReplied(ModMail.ModMailId);
    await ModMailRepository.TouchActivity(ModMail.ModMailId);

    if (Delivered) {
        await Message.react('✅').catch(() => {});
    } else {
        await Message.react('⚠️').catch(() => {});
        await Message.channel.send({ content: `⚠️ ${ReplyNotDeliveredNote}`, allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (Delivered && NotForwarded.length > 0) {
        await Message.reply({ content: `⚠️ These files were not sent to the user:\n${FormatNotForwarded(NotForwarded)}`, allowedMentions: { parse: [] } }).catch(() => {});
    }
    // Once a moderator has replied, the mail can no longer be passed to the other team.
    if (IsFirstReply) {
        await RefreshThreadCard(Context, Message.client, ModMail.ModMailId);
    }
}

export async function HandleModMailOpen(Interaction, Context) {
    const Open = await Context.Services.ModMailRepository.FindOpenByUser(Interaction.user.id);
    if (Open) {
        await Interaction.update(BuildAlreadyOpenView(Open.GuildType));
        return;
    }
    const { Teams, Allowed } = await GetAllowedTeams(Context, Interaction.user.id);
    if (Allowed.length === 0) {
        await Interaction.update(Teams.length > 0 ? BuildModMailRestrictedView(Interaction.user) : BuildModMailUnavailableView());
        return;
    }
    await Interaction.update(BuildTeamSelectView(Interaction.user.id, Allowed));
}

export async function HandleModMailTeamSelect(Interaction, Context) {
    const Open = await Context.Services.ModMailRepository.FindOpenByUser(Interaction.user.id);
    if (Open) {
        await Interaction.update(BuildAlreadyOpenView(Open.GuildType));
        return;
    }
    const GuildId = Interaction.values[0];
    if (await Context.Services.ModMailBanRepository.IsBanned(GuildId, Interaction.user.id)) {
        const Team = (await GetTeams(Context)).find((Candidate) => Candidate.GuildId === GuildId);
        await Interaction.update(BuildTeamRestrictedView(Team?.GuildType));
        return;
    }
    await Interaction.showModal(BuildModMailModal(Interaction.user.id, GuildId));
}

export async function HandleModMailForm(Interaction, Context, { Arguments }) {
    const { ModMailRepository } = Context.Services;
    const GuildId = Arguments[0];
    const Team = (await GetTeams(Context)).find((Candidate) => Candidate.GuildId === GuildId);
    await Interaction.deferReply();

    if (!Team) {
        await Interaction.editReply(BuildModMailUnavailableView());
        return;
    }
    if (await Context.Services.ModMailBanRepository.IsBanned(GuildId, Interaction.user.id)) {
        await Interaction.editReply(BuildTeamRestrictedView(Team.GuildType));
        return;
    }
    const ModMailId = await ModMailRepository.Create({
        GuildId,
        DiscordUserId: Interaction.user.id,
        Title: Interaction.fields.getTextInputValue(ModMailTitleInputId),
        Inquiry: Interaction.fields.getTextInputValue(ModMailInquiryInputId),
        ForumChannelId: Team.ChannelId,
    });
    if (!ModMailId) {
        const Open = await ModMailRepository.FindOpenByUser(Interaction.user.id);
        await Interaction.editReply(BuildAlreadyOpenView(Open?.GuildType));
        return;
    }

    const ModMail = await CreateThreadForMail(Context, Interaction.client, ModMailId);
    if (!ModMail) {
        await Interaction.editReply(BuildModMailUnavailableView());
        return;
    }
    Context.Logger.Info('Mod mail opened', { ModMailId, DiscordUserId: Interaction.user.id, GuildId, ThreadId: ModMail.ThreadId });
    await Interaction.editReply(BuildModMailOpenedView(ModMail, Interaction.client.user?.displayAvatarURL?.()));
    await Interaction.message?.delete().catch(() => {});
}

async function FindOpenMailForThread(Interaction, Context, ModMailId) {
    const ModMail = await Context.Services.ModMailRepository.FindById(ModMailId);
    if (!ModMail || ModMail.Status !== 'OPEN' || ModMail.GuildId !== Interaction.guildId) {
        await Interaction.reply(EphemeralView(BuildModMailResultView('Mod Mail Not Open', 'This mod mail has already been closed or passed on.', { Success: false })));
        return null;
    }
    return ModMail;
}

export async function HandleModMailClose(Interaction, Context, { Arguments }) {
    const ModMail = await FindOpenMailForThread(Interaction, Context, Arguments[0]);
    if (!ModMail) {
        return;
    }
    await Interaction.reply(
        EphemeralView(
            BuildModMailConfirmView(
                'Are you sure you want to close this mod mail?',
                BuildCustomId(ModMailActions.ConfirmClose, Interaction.user.id, ModMail.ModMailId),
                BuildCustomId(ModMailActions.Cancel, Interaction.user.id),
            ),
        ),
    );
}

export async function HandleModMailConfirmClose(Interaction, Context, { Arguments }) {
    const { ModMailRepository } = Context.Services;
    // Answer Discord straight away: closing takes several API calls, more than the 3 seconds allowed.
    await ShowLoading(Interaction, 'Closing...');
    const ModMail = await ModMailRepository.FindById(Arguments[0]);
    if (!ModMail || !(await ModMailRepository.Close(ModMail.ModMailId, Interaction.user.id))) {
        await Interaction.editReply(BuildModMailResultView('Mod Mail Not Open', 'This mod mail has already been closed or passed on.', { Success: false }));
        return;
    }

    try {
        const User = await Interaction.client.users.fetch(ModMail.DiscordUserId);
        await User.send(BuildModMailClosedDmView(ModMail.GuildType));
    } catch (DmError) {
        Context.Logger.Debug('Could not send mod mail closed DM', { ModMailId: ModMail.ModMailId, Error: DmError });
    }

    await RefreshThreadCard(Context, Interaction.client, ModMail.ModMailId);
    const Thread = await FetchChannel(Interaction.client, ModMail.ThreadId);
    await Thread?.send({ content: `🔒 Closed by ${Interaction.member?.displayName ?? Interaction.user.username}!`, allowedMentions: { parse: [] } }).catch(() => {});
    await Thread?.setLocked(true).catch((LockError) => Context.Logger.Warn('Could not lock mod mail thread', { ModMailId: ModMail.ModMailId, Error: LockError }));
    Context.Logger.Info('Mod mail closed', { ModMailId: ModMail.ModMailId, StaffDiscordUserId: Interaction.user.id });

    await Interaction.editReply(BuildModMailResultView('Mod Mail Closed', 'Mod mail has been closed successfully.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

// Called by /modmailban: an open mail with the banning server's team is closed and its thread locked.
export async function CloseModMailForBan(Context, Client, { GuildId, DiscordUserId, ModeratorName }) {
    const { ModMailRepository } = Context.Services;
    const Open = await ModMailRepository.FindOpenByUser(DiscordUserId);
    if (!Open || Open.GuildId !== GuildId || !(await ModMailRepository.Close(Open.ModMailId, null))) {
        return false;
    }
    await RefreshThreadCard(Context, Client, Open.ModMailId);
    const Thread = await FetchChannel(Client, Open.ThreadId);
    await Thread?.send({ content: `🔒 Closed: the member was banned from mod mail by ${ModeratorName}.`, allowedMentions: { parse: [] } }).catch(() => {});
    await Thread?.setLocked(true).catch((LockError) => Context.Logger.Warn('Could not lock mod mail thread', { ModMailId: Open.ModMailId, Error: LockError }));
    return true;
}

export async function HandleModMailPass(Interaction, Context, { Arguments }) {
    const ModMail = await FindOpenMailForThread(Interaction, Context, Arguments[0]);
    if (!ModMail) {
        return;
    }
    const OtherTeam = await GetOtherTeam(Context, ModMail.GuildId);
    const Problem = !OtherTeam
        ? 'There is no other team to pass to.'
        : ModMail.FirstModReplyTimestamp
          ? 'A moderator has already replied, so this mod mail can no longer be passed on.'
          : (await Context.Services.ModMailBanRepository.IsBanned(OtherTeam.GuildId, ModMail.DiscordUserId))
            ? `This member is banned from mod mail with the **${TeamName(OtherTeam.GuildType)}**.`
            : null;
    if (Problem) {
        await Interaction.reply(EphemeralView(BuildModMailResultView('Cannot Pass', Problem, { Success: false })));
        return;
    }
    await Interaction.reply(
        EphemeralView(
            BuildModMailConfirmView(
                `Pass this mod mail to the **${TeamName(OtherTeam.GuildType)}**? This thread will be closed and a new mod mail opened in their server.`,
                BuildCustomId(ModMailActions.ConfirmPass, Interaction.user.id, ModMail.ModMailId),
                BuildCustomId(ModMailActions.Cancel, Interaction.user.id),
            ),
        ),
    );
}

export async function HandleModMailConfirmPass(Interaction, Context, { Arguments }) {
    const { ModMailRepository } = Context.Services;
    // Answer Discord straight away: passing takes several API calls, more than the 3 seconds allowed.
    await ShowLoading(Interaction, 'Passing...');
    const ModMail = await ModMailRepository.FindById(Arguments[0]);
    const OtherTeam = ModMail ? await GetOtherTeam(Context, ModMail.GuildId) : null;
    const Refuse = (Text) => Interaction.editReply(BuildModMailResultView('Cannot Pass', Text, { Success: false }));

    if (!ModMail || !OtherTeam) {
        await Refuse('This mod mail or the other team could not be found.');
        return;
    }
    if (await Context.Services.ModMailBanRepository.IsBanned(OtherTeam.GuildId, ModMail.DiscordUserId)) {
        await Refuse(`This member is banned from mod mail with the **${TeamName(OtherTeam.GuildType)}**.`);
        return;
    }
    // Checked again here, atomically, in case a moderator replied since the button was pressed.
    if (!(await ModMailRepository.MarkPassed(ModMail.ModMailId, Interaction.user.id))) {
        await Refuse('A moderator has already replied, or the mod mail was closed, so it can no longer be passed on.');
        return;
    }

    const NewModMailId = await ModMailRepository.Create({
        GuildId: OtherTeam.GuildId,
        DiscordUserId: ModMail.DiscordUserId,
        Title: ModMail.Title,
        Inquiry: ModMail.Inquiry,
        ForumChannelId: OtherTeam.ChannelId,
        PassedFromModMailId: ModMail.ModMailId,
    });
    const NewModMail = NewModMailId ? await CreateThreadForMail(Context, Interaction.client, NewModMailId) : null;
    if (!NewModMail) {
        await ModMailRepository.UndoPass(ModMail.ModMailId);
        await Refuse('The mod mail could not be opened in the other server. Nothing has changed; please try again or contact Habbo Staff.');
        return;
    }

    await RefreshThreadCard(Context, Interaction.client, ModMail.ModMailId);
    const Thread = await FetchChannel(Interaction.client, ModMail.ThreadId);
    await Thread?.send({ content: `➡️ Passed to other team (**${TeamName(OtherTeam.GuildType)}**) by ${Interaction.member?.displayName ?? Interaction.user.username}.`, allowedMentions: { parse: [] } }).catch(() => {});
    await Thread?.setLocked(true).catch((LockError) => Context.Logger.Warn('Could not lock mod mail thread', { ModMailId: ModMail.ModMailId, Error: LockError }));

    try {
        const User = await Interaction.client.users.fetch(ModMail.DiscordUserId);
        await User.send(BuildModMailPassedDmView(OtherTeam.GuildType));
    } catch (DmError) {
        Context.Logger.Debug('Could not send mod mail passed DM', { ModMailId: ModMail.ModMailId, Error: DmError });
    }
    Context.Logger.Info('Mod mail passed to the other team', { ModMailId: ModMail.ModMailId, NewModMailId, StaffDiscordUserId: Interaction.user.id, ToGuildId: OtherTeam.GuildId });

    await Interaction.editReply(BuildModMailResultView('Mod Mail Passed', `Passed to the **${TeamName(OtherTeam.GuildType)}**. This thread is now closed.`));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

export async function HandleModMailCancel(Interaction, Context) {
    await Interaction.update(BuildModMailResultView('Cancelled', 'Nothing was changed.'));
    ScheduleSelfDestruct(Interaction, Context.Logger);
}

export const ModMailHandlers = Object.freeze({
    ComponentHandlers: {
        [ModMailActions.Open]: HandleModMailOpen,
        [ModMailActions.Team]: HandleModMailTeamSelect,
        [ModMailActions.Close]: HandleModMailClose,
        [ModMailActions.ConfirmClose]: HandleModMailConfirmClose,
        [ModMailActions.Pass]: HandleModMailPass,
        [ModMailActions.ConfirmPass]: HandleModMailConfirmPass,
        [ModMailActions.Cancel]: HandleModMailCancel,
    },
    ModalHandlers: { [ModMailActions.Form]: HandleModMailForm },
});
