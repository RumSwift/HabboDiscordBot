import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { MaxUsernameLength } from '../Services/VerificationService.js';
import { GameLabels, GetHotel } from '../Utils/HotelConfiguration.js';

export const UsernameInputId = 'HabboUsername';

export function BuildHabboUsernameModal({ OwnerDiscordUserId, HotelCode }) {
    const GameLabel = GameLabels[GetHotel(HotelCode).Game];
    const UsernameInput = new TextInputBuilder()
        .setCustomId(UsernameInputId)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(MaxUsernameLength)
        .setPlaceholder(`Your ${GameLabel} username`);

    return new ModalBuilder()
        .setCustomId(BuildCustomId('UsernameModal', OwnerDiscordUserId, HotelCode))
        .setTitle(`Enter Your ${GameLabel} Username`)
        .addLabelComponents(new LabelBuilder().setLabel(`${GameLabel} Username`).setTextInputComponent(UsernameInput));
}
