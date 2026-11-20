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

export const MaxCardTextLength = 4000;

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
