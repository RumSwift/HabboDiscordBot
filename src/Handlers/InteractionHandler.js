import { MessageFlags } from 'discord.js';
import { AnyUser, ParseCustomId } from '../Utils/CustomId.js';
import { BuildErrorView, EphemeralView } from '../Components/ComponentStyles.js';

export class InteractionHandler {
    constructor({ Commands, ComponentHandlers, ModalHandlers, Context, Logger }) {
        this.Commands = Commands;
        this.ComponentHandlers = ComponentHandlers;
        this.ModalHandlers = ModalHandlers;
        this.Context = Context;
        this.Logger = Logger;
    }

    async HandleInteraction(Interaction) {
        try {
            if (Interaction.isChatInputCommand()) {
                await this.HandleCommand(Interaction);
            } else if (Interaction.isButton() || Interaction.isAnySelectMenu()) {
                await this.HandleCustomIdInteraction(Interaction, this.ComponentHandlers);
            } else if (Interaction.isModalSubmit()) {
                await this.HandleCustomIdInteraction(Interaction, this.ModalHandlers);
            }
        } catch (HandlerError) {
            this.Logger.Error('Error while handling interaction', {
                DiscordUserId: Interaction.user?.id,
                CustomId: Interaction.customId,
                CommandName: Interaction.commandName,
                Error: HandlerError,
            });
            await this.SendErrorResponse(Interaction);
        }
    }

    async HandleCommand(Interaction) {
        const Command = this.Commands.get(Interaction.commandName);
        if (!Command) {
            this.Logger.Warn('Received an unknown slash command', { CommandName: Interaction.commandName });
            await Interaction.reply({ content: 'This command is no longer available.', flags: MessageFlags.Ephemeral });
            return;
        }
        await Command.Execute(Interaction, this.Context);
    }

    async HandleCustomIdInteraction(Interaction, Handlers) {
        const Parsed = ParseCustomId(Interaction.customId);
        const Handler = Parsed ? Handlers.get(Parsed.Action) : null;

        if (!Handler) {
            await Interaction.reply({ content: 'This menu has expired. Please run the command again.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (Parsed.OwnerDiscordUserId !== AnyUser && Parsed.OwnerDiscordUserId !== Interaction.user.id) {
            this.Logger.Warn('User tried to use another user\'s menu', { DiscordUserId: Interaction.user.id, Action: Parsed.Action });
            await Interaction.reply({ content: 'This menu belongs to someone else. Run the command yourself to get your own.', flags: MessageFlags.Ephemeral });
            return;
        }

        await Handler(Interaction, this.Context, Parsed);
    }

    async SendErrorResponse(Interaction) {
        if (!Interaction.isRepliable?.()) {
            return;
        }
        try {
            const ErrorView = BuildErrorView(Interaction.user?.id);
            if (Interaction.deferred || Interaction.replied) {
                await Interaction.editReply(ErrorView);
            } else {
                await Interaction.reply(EphemeralView(ErrorView));
            }
        } catch (ResponseError) {
            // The interaction token may have expired. Nothing more we can do.
            this.Logger.Debug('Could not send error response', { Error: ResponseError });
        }
    }
}
