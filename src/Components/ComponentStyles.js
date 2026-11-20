import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder,
} from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { ApplicationEmoji, FormatEmoji } from '../Utils/ApplicationEmojis.js';

export const Colours = Object.freeze({
    Primary: 0x5865f2,
    Success: 0x2ecc71,
    Warning: 0xf1c40f,
    Danger: 0xe74c3c,
    Neutral: 0x95a5a6,
});

export const Emojis = Object.freeze({
    Plus: ApplicationEmoji('Plus', '1558790263084810240', '➕'),
    Minus: ApplicationEmoji('Minus', '1558790261600161872', '➖'),
    Neutral: ApplicationEmoji('Neutral', '1558791468817186837', '⚪'),
    Deleted: ApplicationEmoji('NoSound', '1558797359079497829', '🗑️'),
    ArrowLeft: ApplicationEmoji('ArrowLeft', '1558786179485278310', '⬅️'),
    ArrowRight: ApplicationEmoji('ArrowRight', '1558786180605026346', '➡️'),
});

export { FormatEmoji };

const FrankImageBaseUrl = 'https://files.habboemotion.com/resources/images/frank';
export const Thumbnails = Object.freeze({
    Dashboard: `${FrankImageBaseUrl}/frank_11.gif`,
    HotelSelection: `${FrankImageBaseUrl}/frank_16.gif`,
    Verification: `${FrankImageBaseUrl}/frank_22.gif`,
    MottoMismatch: `${FrankImageBaseUrl}/frank_19.gif`,
    Verified: `${FrankImageBaseUrl}/frank_13.gif`,
    UnlinkConfirmation: `${FrankImageBaseUrl}/frank_24.gif`,
    Unlinked: `${FrankImageBaseUrl}/frank_08.gif`,
});

export const VerifyCommandName = 'verifyhabbo';
export const VerifyCommandText = `/${VerifyCommandName}`;

export function View(Embed, Rows = []) {
    const Data = Embed.toJSON();
    const Container = new ContainerBuilder();
    if (Data.color !== undefined) {
        Container.setAccentColor(Data.color);
    }

    const HeaderTexts = [new TextDisplayBuilder().setContent(`### ${Data.title}`)];
    if (Data.description) {
        HeaderTexts.push(new TextDisplayBuilder().setContent(Data.description));
    }
    if (Data.thumbnail?.url) {
        Container.addSectionComponents(
            new SectionBuilder().addTextDisplayComponents(HeaderTexts).setThumbnailAccessory(new ThumbnailBuilder().setURL(Data.thumbnail.url)),
        );
    } else {
        Container.addTextDisplayComponents(HeaderTexts);
    }

    const Fields = Data.fields ?? [];
    if (Fields.length > 0) {
        Container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        Container.addTextDisplayComponents(Fields.map((Field) => new TextDisplayBuilder().setContent(`**${Field.name}**\n${Field.value}`)));
    }
    if (Data.footer?.text) {
        Container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${Data.footer.text}`));
    }
    if (Rows.length > 0) {
        Container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        Container.addActionRowComponents(Rows);
    }

    return { components: [Container], flags: MessageFlags.IsComponentsV2 };
}

export const SelfDestructSeconds = 10;
export const SelfDestructNote = `This message will self destruct in ${SelfDestructSeconds} seconds`;

export function EphemeralView(ViewData) {
    return { ...ViewData, flags: ViewData.flags | MessageFlags.Ephemeral };
}

export function StartAgainRow(OwnerDiscordUserId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('Dashboard', OwnerDiscordUserId)).setLabel('Start Again').setStyle(ButtonStyle.Primary),
    );
}

export function BuildErrorView(OwnerDiscordUserId, Message = 'Something went wrong while processing your request. Please try again in a moment.') {
    const Embed = new EmbedBuilder().setTitle('Something Went Wrong').setDescription(Message).setColor(Colours.Danger);
    return View(Embed, OwnerDiscordUserId ? [StartAgainRow(OwnerDiscordUserId)] : []);
}
