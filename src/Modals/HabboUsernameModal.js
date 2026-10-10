import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { MaxUsernameLength } from '../Services/VerificationService.js';

export const UsernameInputId = 'HabboUsername';

export function BuildHabboUsernameModal({ OwnerDiscordUserId, HotelCode }) {
    const UsernameInput = new TextInputBuilder()
        .setCustomId(UsernameInputId)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(MaxUsernameLength)
        .setPlaceholder('Your Habbo username');

    return new ModalBuilder()
        .setCustomId(BuildCustomId('UsernameModal', OwnerDiscordUserId, HotelCode))
        .setTitle('Enter Your Habbo Username')
        .addLabelComponents(new LabelBuilder().setLabel('Habbo Username').setTextInputComponent(UsernameInput));
}
