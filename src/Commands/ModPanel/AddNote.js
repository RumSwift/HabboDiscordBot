import { escapeMarkdown, MessageFlags } from 'discord.js';
import { BuildAddNoteModal, BuildModPanelResultView, NoteInputs, NoteVisibility, ServerName } from '../../Components/ModPanelComponents.js';
import { ScheduleSelfDestruct } from '../../Flows/FlowHelpers.js';
import { NoteScopes } from '../../Repositories/ModNoteRepository.js';
import { ClosePanel } from './OpenPanels.js';

export async function ShowAddNoteModal(Interaction, Context, { TargetId }) {
    await Interaction.showModal(BuildAddNoteModal(Interaction.user.id, TargetId));
}

export async function HandleAddNoteForm(Interaction, Context, { TargetId }) {
    const Field = (Id) => Interaction.fields.getTextInputValue(Id).trim();
    const Title = Field(NoteInputs.Title);
    const NoteText = Field(NoteInputs.Text);
    const MessageLink = Field(NoteInputs.MessageLink) || null;
    const IsGlobal = Interaction.fields.getStringSelectValues(NoteInputs.Visibility)[0] !== NoteVisibility.ThisServer;
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Fail = (Description) => Interaction.editReply(BuildModPanelResultView('Add Note Failed', Description, { Success: false }));

    const { GuildConfigurationRepository, ModNoteRepository, ModActionLogService } = Context.Services;
    const [Target, Guilds] = await Promise.all([Interaction.client.users.fetch(TargetId).catch(() => null), GuildConfigurationRepository.GetGuilds()]);
    if (!Target) {
        await Fail('This user could not be found.');
        return;
    }
    const Origin = Guilds.find((Guild) => Guild.GuildId === Interaction.guildId);
    if (!Origin) {
        await Fail('This server is not set up for the Modpanel.');
        return;
    }

    const Author = Interaction.user;
    const NoteId = await ModNoteRepository.Add({
        DiscordUserId: TargetId,
        OriginGuildId: Origin.GuildId,
        Scope: IsGlobal ? NoteScopes.Global : NoteScopes.Server,
        Title,
        NoteText,
        MessageLink,
        AuthorDiscordUserId: Author.id,
    }).catch((SaveError) => {
        Context.Logger.Error('Could not save note', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: SaveError });
        return null;
    });
    if (!NoteId) {
        await Fail('The note could not be saved. Please try again or contact Habbo Staff.');
        return;
    }

    const OriginName = ServerName(Origin.GuildType);
    const Destinations = IsGlobal ? [Origin, ...Guilds.filter((Guild) => Guild.GuildId !== Origin.GuildId)] : [Origin];
    const LogLinks = await Promise.all(
        Destinations.map(async (Guild) => {
            const IsOrigin = Guild.GuildId === Origin.GuildId;
            const LogMessage = await ModActionLogService.LogNote({
                GuildId: Guild.GuildId,
                Target,
                Title,
                NoteText,
                MessageLink,
                OriginName,
                IsGlobal,
                Author: IsOrigin ? Author : null,
            }).catch((LogError) => {
                Context.Logger.Error('Could not log note', { GuildId: Guild.GuildId, NoteId, Error: LogError });
                return null;
            });
            if (LogMessage?.url) {
                await ModNoteRepository.AddLogLink(NoteId, Guild.GuildId, LogMessage.url).catch((LinkError) =>
                    Context.Logger.Error('Could not save note log link', { GuildId: Guild.GuildId, NoteId, Error: LinkError }),
                );
            }
            return LogMessage?.url ?? null;
        }),
    );
    const LogUrl = LogLinks[0];
    Context.Logger.Info('Note added', { GuildId: Interaction.guildId, DiscordUserId: TargetId, StaffDiscordUserId: Author.id, NoteId, IsGlobal });

    const Lines = [`**Title:** ${escapeMarkdown(Title)}`, `**Visible In:** ${IsGlobal ? '🌍 All servers (global note)' : '🔒 This server only'}`];
    if (LogUrl) {
        Lines.push(`**Log:** ${LogUrl}`);
    }
    await Interaction.editReply(BuildModPanelResultView('📝 User Note Added', Lines.join('\n')));
    ClosePanel(Interaction, TargetId, Context.Logger);
    ScheduleSelfDestruct(Interaction, Context.Logger);
}
