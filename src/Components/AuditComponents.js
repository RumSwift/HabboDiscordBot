import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, time, TimestampStyles, userMention } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { Colours, View } from './ComponentStyles.js';

export const AuditHistoryPageSize = 20;

// Keep the summary within Discord's 4096-character embed description limit.
const MaxAccountsShown = 15;

function FormatAccountName(HabboUsername, HotelCode) {
    return `**${escapeMarkdown(HabboUsername)}** (${HotelCode})`;
}

export function BuildAuditSummaryView({ OwnerDiscordUserId, TargetDiscordUserId, TargetAvatarUrl = null, Accounts, Summary }) {
    const Lines = [`**Discord User:** ${userMention(TargetDiscordUserId)} (${TargetDiscordUserId})`, ''];

    const ActiveLink = Summary.ActiveLink;
    Lines.push('**Current Link**');
    Lines.push(
        ActiveLink
            ? `🟢 ${FormatAccountName(ActiveLink.HabboUsername, ActiveLink.HotelCode)} since ${time(new Date(ActiveLink.LinkedTimestamp), TimestampStyles.LongDateTime)}`
            : '⚪ Not currently linked',
    );
    Lines.push('');

    Lines.push(`**Linked Habbo Accounts (${Accounts.length})**`);
    if (Accounts.length === 0) {
        Lines.push('This user has never linked a Habbo account.');
    }
    for (const Account of Accounts.slice(0, MaxAccountsShown)) {
        const Status = Account.IsActive
            ? 'Active'
            : `Unlinked ${time(new Date(Account.LastUnlinkedTimestamp), TimestampStyles.ShortDate)}`;
        Lines.push(
            `${Account.IsActive ? '🟢' : '🔴'} ${FormatAccountName(Account.HabboUsername, Account.HotelCode)}\n` +
                `   Linked ${Account.LinkCount}× · first ${time(new Date(Account.FirstLinkedTimestamp), TimestampStyles.ShortDate)}` +
                ` · last ${time(new Date(Account.LastLinkedTimestamp), TimestampStyles.ShortDate)} · ${Status}`,
        );
    }
    if (Accounts.length > MaxAccountsShown) {
        Lines.push(`…and ${Accounts.length - MaxAccountsShown} more. Use **Full History** to see everything.`);
    }

    const Embed = new EmbedBuilder()
        .setTitle('🔎 Verification Audit')
        .setDescription(Lines.join('\n'))
        .setColor(Colours.Primary);
    if (TargetAvatarUrl) {
        Embed.setThumbnail(TargetAvatarUrl);
    }

    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BuildCustomId('AuditHistory', OwnerDiscordUserId, TargetDiscordUserId, 1))
            .setLabel('Full History')
            .setEmoji('📜')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(Accounts.length === 0),
    );

    return View(Embed, [Row]);
}

export function FormatAuditEventLine(Event) {
    const IsLinked = Event.ActionType === 'LINKED';
    const Notes = [];
    if (Event.Details?.Reason === 'REPLACED') {
        Notes.push('replaced');
    } else if (Event.Details?.Source && !['VERIFICATION', 'DISCORD'].includes(Event.Details.Source)) {
        Notes.push(`via ${Event.Details.Source}`);
    }
    const NoteText = Notes.length > 0 ? ` · *${Notes.join(', ')}*` : '';
    return `${IsLinked ? '✅' : '❌'} **${Event.ActionType}** ${FormatAccountName(Event.HabboUsername, Event.HotelCode)} · ${time(new Date(Event.EventTimestamp), TimestampStyles.ShortDateTime)}${NoteText}`;
}

export function BuildAuditHistoryView({ OwnerDiscordUserId, TargetDiscordUserId, Events, Page, TotalPages }) {
    const Header = `**Discord User:** ${userMention(TargetDiscordUserId)} (${TargetDiscordUserId})\n\n`;
    const Body = Events.length > 0 ? Events.map(FormatAuditEventLine).join('\n') : 'No link history for this user.';

    const Embed = new EmbedBuilder()
        .setTitle('📜 Full Link History')
        .setDescription(Header + Body)
        .setFooter({ text: `Page ${Page} of ${TotalPages}` })
        .setColor(Colours.Primary);

    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BuildCustomId('AuditHistory', OwnerDiscordUserId, TargetDiscordUserId, Page - 1))
            .setLabel('Previous')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Page <= 1),
        new ButtonBuilder()
            .setCustomId(BuildCustomId('AuditHistory', OwnerDiscordUserId, TargetDiscordUserId, Page + 1))
            .setLabel('Next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Page >= TotalPages),
        new ButtonBuilder()
            .setCustomId(BuildCustomId('AuditSummary', OwnerDiscordUserId, TargetDiscordUserId))
            .setLabel('Back to Summary')
            .setStyle(ButtonStyle.Primary),
    );

    return View(Embed, [Row]);
}

export function BuildAuditPermissionDeniedView() {
    const Embed = new EmbedBuilder()
        .setTitle('Permission Required')
        .setDescription('You need the **Manage Messages** permission to use this command.')
        .setColor(Colours.Danger);
    return View(Embed, []);
}
