import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown, time, TimestampStyles } from 'discord.js';
import { BuildCustomId } from '../Utils/CustomId.js';
import { GetHotel } from '../Utils/HotelConfiguration.js';
import { Colours, StartAgainRow, Thumbnails, VerifyCommandText, View } from './ComponentStyles.js';

export function FormatRemainingTime(RemainingMs) {
    const TotalSeconds = Math.max(0, Math.ceil(RemainingMs / 1000));
    const Minutes = Math.floor(TotalSeconds / 60);
    const Seconds = TotalSeconds % 60;
    return `${Minutes}m ${String(Seconds).padStart(2, '0')}s`;
}

export function FormatAttemptsRemaining(RemainingAttempts) {
    return `You have ${RemainingAttempts} more ${RemainingAttempts === 1 ? 'attempt' : 'attempts'} before you have to start again.`;
}

export const MismatchMessage = "Sorry, that doesn't match. Please make sure you've updated your Habbo motto to the exact code shown above.";

function CancelButton(OwnerDiscordUserId, ChallengeId = null) {
    const CustomId = ChallengeId ? BuildCustomId('Cancel', OwnerDiscordUserId, ChallengeId) : BuildCustomId('Cancel', OwnerDiscordUserId);
    return new ButtonBuilder().setCustomId(CustomId).setLabel('Cancel').setStyle(ButtonStyle.Danger);
}

export function BuildVerificationView({ OwnerDiscordUserId, ChallengeId, VerificationCode, ExpiresTimestamp, Now = new Date(), HabboUsername, HotelCode, Notice = null }) {
    const ExpiresDate = new Date(ExpiresTimestamp);
    const RemainingMs = ExpiresDate.getTime() - Now.getTime();

    const Embed = new EmbedBuilder()
        .setTitle('Verify Habbo Account Ownership')
        .setDescription(
            'To prove that you own this Habbo account, temporarily change your Habbo motto to the verification code shown below.\n\n' +
                'Once you have updated your motto, return here and click **Check Motto**.\n\n' +
                'Your code is unique to this verification attempt and expires in five minutes. Do not share it with anyone.',
        )
        .setColor(Colours.Warning)
        .setThumbnail(Notice?.Thumbnail ?? Thumbnails.Verification)
        .addFields(
            { name: 'Your Verification Code', value: `\`\`\`\n${VerificationCode}\n\`\`\`` },
            { name: 'Habbo Account', value: `${HabboUsername} (${HotelCode})`, inline: true },
            { name: 'Time Remaining', value: `**${FormatRemainingTime(RemainingMs)}** (expires ${time(ExpiresDate, TimestampStyles.RelativeTime)})`, inline: true },
        );

    if (Notice) {
        Embed.addFields({ name: Notice.Title, value: Notice.Message });
    }

    const Row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('CheckMotto', OwnerDiscordUserId, ChallengeId)).setLabel('Check Motto').setStyle(ButtonStyle.Success),
        CancelButton(OwnerDiscordUserId, ChallengeId),
    );

    return View(Embed, [Row]);
}

export function ExtractVerificationCodeFromMessage(Message) {
    const Texts = CollectTextContent((Message?.components ?? []).map((Component) => (Component.toJSON ? Component.toJSON() : Component)));
    // Messages sent before the switch to Components V2 kept the code in an embed field.
    const LegacyField = Message?.embeds?.[0]?.fields?.find((Item) => Item.name === 'Your Verification Code');
    if (LegacyField) {
        Texts.push(`**Your Verification Code**\n${LegacyField.value}`);
    }
    for (const Text of Texts) {
        const Match = Text.match(/^\*\*Your Verification Code\*\*\n```\n?([^`\n]+)\n?```/);
        if (Match) {
            return Match[1].trim();
        }
    }
    return null;
}

function CollectTextContent(Components) {
    return Components.flatMap((Component) => [
        ...(typeof Component.content === 'string' ? [Component.content] : []),
        ...CollectTextContent(Component.components ?? []),
    ]);
}

export function BuildAccountNotFoundView({ OwnerDiscordUserId, HotelCode }) {
    const Embed = new EmbedBuilder()
        .setTitle('Habbo Account Not Found')
        .setDescription(
            'Sorry, we could not find that account on the selected hotel.\n\n' +
                'Please check the spelling of your username and try again. If your account exists, make sure your profile is not private.',
        )
        .setColor(Colours.Danger);
    return View(Embed, [TryAgainRow(OwnerDiscordUserId, HotelCode)]);
}

export function BuildServiceUnavailableView({ OwnerDiscordUserId, HotelCode, RetryAfterSeconds = null }) {
    const WaitText = RetryAfterSeconds ? ` Please wait about ${RetryAfterSeconds} seconds and try again.` : ' Please try again in a moment.';
    const Embed = new EmbedBuilder()
        .setTitle('Habbo Is Not Responding')
        .setDescription(`We could not reach the Habbo website for the selected hotel just now. This is a temporary problem and does not mean your account is missing.${WaitText}`)
        .setColor(Colours.Warning);
    return View(Embed, [TryAgainRow(OwnerDiscordUserId, HotelCode)]);
}

export function BuildRateLimitedView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Slow Down')
        .setDescription('You have made too many verification requests in a short time. Please wait a few minutes and start again.')
        .setColor(Colours.Warning);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildAlreadyLinkedElsewhereView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Account Already Linked')
        .setDescription(
            'This Habbo account is already linked to a different Discord account, so it cannot be linked again.\n\n' +
                'If you believe this is a mistake, please contact a member of staff.',
        )
        .setColor(Colours.Danger);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildAlreadyLinkedToYouView({ OwnerDiscordUserId, HabboUsername, HotelCode }) {
    const Embed = new EmbedBuilder()
        .setTitle('Already Linked')
        .setDescription(`**${HabboUsername}** (${HotelCode}) is already linked to your Discord account. There is nothing more to do.`)
        .setColor(Colours.Success);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildVerificationFailedView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Verification Failed')
        .setDescription(`Sorry, we were unable to link your Habbo account.\n\nPlease start again using ${VerifyCommandText}.`)
        .setColor(Colours.Danger);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildVerificationExpiredView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Verification Expired')
        .setDescription(`Your verification code has expired because the five-minute time limit has passed.\n\nPlease start again using ${VerifyCommandText}.`)
        .setColor(Colours.Neutral);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildVerificationCancelledView() {
    const Embed = new EmbedBuilder()
        .setTitle('Verification Cancelled')
        .setDescription('Okay, the verification process has been cancelled.')
        .setColor(Colours.Neutral);
    return View(Embed, []);
}

export function BuildChallengeClosedView({ OwnerDiscordUserId }) {
    const Embed = new EmbedBuilder()
        .setTitle('Verification No Longer Active')
        .setDescription(`This verification attempt is no longer active (it may have been replaced by a newer one).\n\nPlease start again using ${VerifyCommandText}.`)
        .setColor(Colours.Neutral);
    return View(Embed, [StartAgainRow(OwnerDiscordUserId)]);
}

export function BuildVerifiedView({ HabboUsername, HotelCode }) {
    const Embed = new EmbedBuilder()
        .setTitle('Habbo Account Verified!')
        .setDescription(
            'Your Habbo account has been successfully linked to your Discord account.\n\n' +
                `**Habbo Username:** ${HabboUsername}\n\n` +
                `**Hotel:** ${HotelCode}\n\n` +
                'You can now use the features available to verified members.\n\n' +
                '*You can change your Habbo motto back now.*',
        )
        .setColor(Colours.Success)
        .setThumbnail(Thumbnails.Verified);
    return View(Embed, []);
}

export function BuildLookupLoadingView({ HabboUsername, HotelCode }) {
    const Embed = new EmbedBuilder()
        .setTitle('⏳ Looking Up Your Habbo Account')
        .setDescription(`Searching for **${escapeMarkdown(HabboUsername)}** on **${GetHotel(HotelCode).Hostname}**...\n\nThis can take a few seconds. Please wait.`)
        .setColor(Colours.Neutral);
    return View(Embed, []);
}

function TryAgainRow(OwnerDiscordUserId, HotelCode) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BuildCustomId('TryAgain', OwnerDiscordUserId, HotelCode)).setLabel('Try Again').setStyle(ButtonStyle.Primary),
        CancelButton(OwnerDiscordUserId),
    );
}
