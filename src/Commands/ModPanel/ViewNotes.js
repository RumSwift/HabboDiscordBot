import { MessageFlags } from 'discord.js';
import { BuildModPanelResultView, BuildViewNotesView } from '../../Components/ModPanelComponents.js';

export async function HandleViewNotes(Interaction, Context, { TargetId }) {
    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const [Target, Notes] = await Promise.all([
            Interaction.client.users.fetch(TargetId),
            Context.Services.ModNoteRepository.GetVisibleNotes(Interaction.guildId, TargetId),
        ]);
        await Interaction.editReply(BuildViewNotesView(Target, Interaction.guildId, Notes));
    } catch (ViewError) {
        Context.Logger.Error('Could not load notes', { GuildId: Interaction.guildId, DiscordUserId: TargetId, Error: ViewError });
        await Interaction.editReply(BuildModPanelResultView('View Notes Failed', 'The notes could not be loaded. Please try again or contact Habbo Staff.', { Success: false }));
    }
}
