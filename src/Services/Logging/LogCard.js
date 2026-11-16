import {
    ActionRowBuilder,
    ContainerBuilder,
    escapeMarkdown,
    roleMention,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
    ThumbnailBuilder,
    time,
    TimestampStyles,
    userMention,
} from 'discord.js';

// Discord's limit on all text in one Components V2 message.
export const MaxCardTextLength = 4000;

// A ``` inside the text is broken up so it can't end the block early.
export function FormatCodeBlock(Text, MaxLength) {
    let Safe = Text.replaceAll('```', '`​`​`');
    if (Safe.length > MaxLength) {
        Safe = `${Safe.slice(0, MaxLength)}…`;
    }
    return `\`\`\`\n${Safe}\n\`\`\``;
}

export function FormatDate(When) {
    return When ? `${time(When, TimestampStyles.LongDate)} · ${time(When, TimestampStyles.RelativeTime)}` : 'Unknown';
}

// Highest role first, leaving out @everyone; long lists are cut short to fit the card.
export function FormatRoles(Roles, GuildId, MaxLength = 1500) {
    const Sorted = [...Roles].filter((Role) => Role.id !== GuildId).sort((A, B) => B.position - A.position);
    if (Sorted.length === 0) {
        return 'None';
    }
    let Text = '';
    for (const [Index, Role] of Sorted.entries()) {
        const Next = Text ? `${Text} ${roleMention(Role.id)}` : roleMention(Role.id);
        if (Next.length > MaxLength) {
            return `${Text} …and ${Sorted.length - Index} more`;
        }
        Text = Next;
    }
    return Text;
}

function Separator(Spacing) {
    return new SeparatorBuilder().setDivider(true).setSpacing(Spacing);
}

// Layout shared by every log, top to bottom:
//   title, user and ID beside their profile picture
//   one block per field: bold label, value underneath
//   anything extra (gallery, files) from AddExtras
//   small footer with reference IDs and the time, then any buttons
export function BuildLogCard({ Title, User, Colour, Fields = [], AddExtras = null, FooterNotes = [], Buttons = [], Now = new Date() }) {
    const Card = new ContainerBuilder().setAccentColor(Colour);

    const Header = [
        new TextDisplayBuilder().setContent(`### ${Title}`),
        new TextDisplayBuilder().setContent(`${userMention(User.id)} · ${escapeMarkdown(User.username)}\n-# ID: ${User.id}`),
    ];
    const AvatarUrl = User.displayAvatarURL?.();
    if (AvatarUrl) {
        Card.addSectionComponents(new SectionBuilder().addTextDisplayComponents(Header).setThumbnailAccessory(new ThumbnailBuilder().setURL(AvatarUrl)));
    } else {
        Card.addTextDisplayComponents(Header);
    }
    Card.addSeparatorComponents(Separator(SeparatorSpacingSize.Large));

    for (const { Label, Value } of Fields) {
        Card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${Label}**\n${Value}`));
    }
    AddExtras?.(Card);

    Card.addSeparatorComponents(Separator(SeparatorSpacingSize.Small));
    Card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${[...FooterNotes, time(Now, TimestampStyles.LongDateTime)].join(' · ')}`));
    if (Buttons.length > 0) {
        Card.addActionRowComponents(new ActionRowBuilder().addComponents(Buttons));
    }
    return Card;
}
