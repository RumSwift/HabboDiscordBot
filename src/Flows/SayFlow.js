import { randomBytes } from 'node:crypto';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, roleMention } from 'discord.js';
import { BuildAuditPermissionDeniedView } from '../Components/AuditComponents.js';
import { EphemeralView } from '../Components/ComponentStyles.js';
import {
    BuildSayEmbedModal,
    BuildSayEmbedRetryView,
    BuildSayFailedView,
    BuildSaySentView,
    DefaultSayEmbedColour,
    SayEmbedColourInputId,
    SayEmbedContentInputId,
    SayEmbedTitleInputId,
} from '../Components/SayComponents.js';
import { HasAuditPermission } from './AuditFlow.js';
import { ScheduleSelfDestruct } from './FlowHelpers.js';

const SendPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];

// Typing \n in the message box gives a new line.
export function FormatSayText(Text) {
    return Text.replaceAll('\\n', '\n');
}

// Only users and roles tagged explicitly (<@id>, <@!id>, <@&id>) ping; @everyone and @here never do.
export function BuildSayMentions(Text) {
    const Collect = (Pattern) => [...new Set([...Text.matchAll(Pattern)].map((Match) => Match[1]))].slice(0, 100);
    return { parse: [], users: Collect(/<@!?(\d{17,20})>/g), roles: Collect(/<@&(\d{17,20})>/g) };
}

// Staff can only post where they could post themselves, and the bot must be able to as well.
// Channel is the target picked on the command (or the current channel); a modal passes the one picked earlier.
async function ResolveSayChannel(Interaction, CommandName, { Channel = Interaction.options?.getChannel('channel') ?? Interaction.channel, BotPermissions = SendPermissions } = {}) {
    if (!HasAuditPermission(Interaction)) {
        await Interaction.reply(EphemeralView(BuildAuditPermissionDeniedView()));
        return null;
    }
    if (!Channel) {
        await Interaction.reply(EphemeralView(BuildSayFailedView(null, 'That channel no longer exists.')));
        return null;
    }
    if (!Interaction.member?.permissionsIn?.(Channel)?.has(SendPermissions)) {
        await Interaction.reply(EphemeralView(BuildSayFailedView(Channel, `You can only use /${CommandName} in channels where you can send messages yourself.`)));
        return null;
    }
    if (!Channel.permissionsFor?.(Interaction.guild.members.me)?.has(BotPermissions) || typeof Channel.send !== 'function') {
        await Interaction.reply(EphemeralView(BuildSayFailedView(Channel, 'The bot cannot send messages there. Check its permissions.')));
        return null;
    }
    return Channel;
}

async function FinishSay(Interaction, Context, Sent, LogMethod) {
    await Interaction.editReply(BuildSaySentView(Sent));
    ScheduleSelfDestruct(Interaction, Context.Logger);
    await Context.Services.SayLogService?.[LogMethod]({ Staff: Interaction.user, GuildId: Interaction.guildId, Message: Sent }).catch((LogError) =>
        Context.Logger.Error(`Could not log ${LogMethod === 'HandleSay' ? '/say' : '/sayembed'}`, { Error: LogError }),
    );
}

export async function ExecuteSayCommand(Interaction, Context) {
    const Channel = await ResolveSayChannel(Interaction, 'say');
    if (!Channel) {
        return;
    }
    const Text = FormatSayText(Interaction.options.getString('message', true));

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const Sent = await Channel.send({ content: Text, allowedMentions: BuildSayMentions(Text) });
    Context.Logger.Info('Message sent with /say', { StaffDiscordUserId: Interaction.user.id, GuildId: Interaction.guildId, ChannelId: Channel.id, MessageId: Sent.id });
    await FinishSay(Interaction, Context, Sent, 'HandleSay');
}

// The bot needs Embed Links as well to post an embed, and Attach Files to re-upload an uploaded image.
const EmbedPermissions = [...SendPermissions, PermissionFlagsBits.EmbedLinks];
const UploadPermissions = [...EmbedPermissions, PermissionFlagsBits.AttachFiles];

// Discord's upload limit for bots in servers without boosts.
export const MaxEmbedImageBytes = 10 * 1024 * 1024;
const ImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

// Accepts "#5865F2" or "5865F2". Returns null when the text is not a hex colour.
export function ParseEmbedColour(Text) {
    const Match = /^#?([0-9a-f]{6})$/i.exec(String(Text ?? '').trim());
    return Match ? Number.parseInt(Match[1], 16) : null;
}

function IsWebUrl(Text) {
    try {
        return ['http:', 'https:'].includes(new URL(Text).protocol);
    } catch {
        return false;
    }
}

// The uploaded file's extension, or null when it is not an image Discord can show in an embed.
function ImageExtension(Attachment) {
    if (Attachment.contentType && !Attachment.contentType.startsWith('image/')) {
        return null;
    }
    const FromName = /\.([a-z0-9]+)$/i.exec(Attachment.name ?? '')?.[1]?.toLowerCase();
    const FromType = /^image\/([a-z0-9]+)/i.exec(Attachment.contentType ?? '')?.[1]?.toLowerCase();
    if (ImageExtensions.includes(FromName)) {
        return FromName;
    }
    return ImageExtensions.includes(FromType) ? FromType : null;
}

// What the command options ask for, checked before the modal opens. Returns { Error } when something is wrong.
export function ReadSayEmbedOptions(Interaction, Channel) {
    // An image link always wins over an upload.
    const ImageLink = Interaction.options.getString('image_link')?.trim() || null;
    if (ImageLink && !IsWebUrl(ImageLink)) {
        return { Error: 'The image link must start with http:// or https://.' };
    }
    const Upload = ImageLink ? null : Interaction.options.getAttachment('image_upload');
    let ImageUpload = null;
    if (Upload) {
        const Extension = ImageExtension(Upload);
        if (!Extension) {
            return { Error: 'The uploaded file must be an image (PNG, JPG, GIF or WebP).' };
        }
        if (Upload.size > MaxEmbedImageBytes) {
            return { Error: 'The uploaded image must be 10 MB or smaller.' };
        }
        ImageUpload = { Url: Upload.url, FileName: `sayembed.${Extension}` };
    }

    const Tag = ReadSayEmbedTag(Interaction, Channel);
    if (Tag.Error) {
        return Tag;
    }
    return { Options: { ImageLink, ImageUpload, Tag: Tag.Tag } };
}

// The ping above the embed: a role, @everyone (picked as the @everyone role) or @here.
// Returns { Tag: { Content, AllowedMentions } | null } or { Error }.
function ReadSayEmbedTag(Interaction, Channel) {
    const Role = Interaction.options.getRole('tag');
    const Here = Interaction.options.getBoolean?.('tag_here') === true;
    if (Role && Here) {
        return { Error: 'Pick a role to tag or @here, not both.' };
    }
    if (!Role && !Here) {
        return { Tag: null };
    }

    const IsEveryone = Here || Role.id === Interaction.guildId;
    const Label = Here ? '@here' : IsEveryone ? '@everyone' : roleMention(Role.id);
    // @everyone, @here and roles that are not mentionable only ping with "Mention @everyone, @here and All Roles".
    const CanPing = (Permissions) => Boolean((!IsEveryone && Role.mentionable) || Permissions?.has(PermissionFlagsBits.MentionEveryone));
    if (!CanPing(Interaction.member?.permissionsIn?.(Channel))) {
        return { Error: `You cannot ping ${Label} in that channel yourself, so the bot will not either.` };
    }
    if (!CanPing(Channel.permissionsFor?.(Interaction.guild.members.me))) {
        return {
            Error: IsEveryone
                ? `The bot cannot ping ${Label} there. Give it "Mention @everyone, @here and All Roles".`
                : `The bot cannot ping ${Label} there. Make the role mentionable, or give the bot "Mention @everyone, @here and All Roles".`,
        };
    }
    if (IsEveryone) {
        return { Tag: { Content: Here ? '@here' : '@everyone', AllowedMentions: { parse: ['everyone'], roles: [] } } };
    }
    return { Tag: { Content: roleMention(Role.id), AllowedMentions: { parse: [], roles: [Role.id] } } };
}

// Options waiting for the modal, which can only carry a short ID. Kept in memory for 15 minutes.
export class PendingSayEmbeds {
    constructor({ Now = () => Date.now(), LifetimeMs = 15 * 60 * 1000 } = {}) {
        this.Entries = new Map();
        this.Now = Now;
        this.LifetimeMs = LifetimeMs;
    }

    Add(Value) {
        for (const [Key, Entry] of this.Entries) {
            if (Entry.ExpiresMs <= this.Now()) {
                this.Entries.delete(Key);
            }
        }
        const Key = randomBytes(9).toString('base64url');
        this.Entries.set(Key, { Value, ExpiresMs: this.Now() + this.LifetimeMs });
        return Key;
    }

    Peek(Key) {
        const Entry = this.Entries.get(Key);
        return Entry && Entry.ExpiresMs > this.Now() ? Entry.Value : null;
    }

    // Keeps what was typed, so the form can be reopened with it after a mistake.
    Update(Key, Changes) {
        const Entry = this.Entries.get(Key);
        if (Entry) {
            Entry.Value = { ...Entry.Value, ...Changes };
        }
    }

    // Each form is sent once.
    Take(Key) {
        const Value = this.Peek(Key);
        this.Entries.delete(Key);
        return Value;
    }
}

export const PendingSayEmbedStore = new PendingSayEmbeds();

export function BuildSayEmbed({ Title, Content, Colour = ParseEmbedColour(DefaultSayEmbedColour), ImageUrl = null }) {
    const Embed = new EmbedBuilder().setDescription(Content).setColor(Colour);
    if (Title) {
        Embed.setTitle(Title);
    }
    if (ImageUrl) {
        Embed.setImage(ImageUrl);
    }
    return Embed;
}

const ExpiredFormView = () => EphemeralView(BuildSayFailedView(null, 'This form has expired. Run /sayembed again.'));

// /sayembed checks where it will post and the options, then opens a modal for the embed's title, content and colour.
export async function ExecuteSayEmbedCommand(Interaction, Context, { Store = PendingSayEmbedStore } = {}) {
    const Upload = !Interaction.options.getString('image_link') && Interaction.options.getAttachment('image_upload');
    const Channel = await ResolveSayChannel(Interaction, 'sayembed', { BotPermissions: Upload ? UploadPermissions : EmbedPermissions });
    if (!Channel) {
        return;
    }
    const { Options, Error } = ReadSayEmbedOptions(Interaction, Channel);
    if (Error) {
        await Interaction.reply(EphemeralView(BuildSayFailedView(Channel, Error)));
        return;
    }
    const Key = Store.Add({ ChannelId: Channel.id, ChannelName: Channel.name, ...Options });
    await Interaction.showModal(BuildSayEmbedModal(Interaction.user.id, Key, Channel.name));
}

// The Try Again button: reopens the form with what was typed.
export async function HandleSayEmbedRetry(Interaction, Context, { Arguments, Store = PendingSayEmbedStore }) {
    const Pending = Store.Peek(Arguments[0]);
    if (!Pending) {
        await Interaction.reply(ExpiredFormView());
        return;
    }
    await Interaction.showModal(BuildSayEmbedModal(Interaction.user.id, Arguments[0], Pending.ChannelName, Pending.Draft));
}

export async function HandleSayEmbedModal(Interaction, Context, { Arguments, Store = PendingSayEmbedStore }) {
    const [Key] = Arguments;
    const Pending = Store.Peek(Key);
    if (!Pending) {
        await Interaction.reply(ExpiredFormView());
        return;
    }
    const Title = Interaction.fields.getTextInputValue(SayEmbedTitleInputId).trim();
    const Content = Interaction.fields.getTextInputValue(SayEmbedContentInputId);
    const ColourText = Interaction.fields.getTextInputValue(SayEmbedColourInputId).trim();
    // An empty colour box means Habbo orange.
    const Colour = ParseEmbedColour(ColourText || DefaultSayEmbedColour);
    if (Colour === null) {
        Store.Update(Key, { Draft: { Title, Content, Colour: ColourText } });
        await Interaction.reply(EphemeralView(BuildSayEmbedRetryView(Interaction.user.id, Key, `"${ColourText}" is not a colour. Use a hex code like ${DefaultSayEmbedColour}.`)));
        return;
    }

    const Target = Interaction.guild?.channels?.cache?.get(Pending.ChannelId) ?? (await Interaction.guild?.channels?.fetch(Pending.ChannelId).catch(() => null));
    // Checked again: permissions may have changed while the modal was open.
    const Channel = await ResolveSayChannel(Interaction, 'sayembed', { Channel: Target, BotPermissions: Pending.ImageUpload ? UploadPermissions : EmbedPermissions });
    Store.Take(Key);
    if (!Channel) {
        return;
    }
    // The uploaded file is sent with the message, so the embed keeps its image after Discord's upload link expires.
    const Files = Pending.ImageUpload ? [{ attachment: Pending.ImageUpload.Url, name: Pending.ImageUpload.FileName }] : [];
    const Embed = BuildSayEmbed({
        Title,
        Content,
        Colour,
        ImageUrl: Pending.ImageLink ?? (Pending.ImageUpload ? `attachment://${Pending.ImageUpload.FileName}` : null),
    });

    await Interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // The tag goes above the embed, because mentions inside an embed never ping. Nothing else pings.
    const Sent = await Channel.send({
        content: Pending.Tag?.Content,
        embeds: [Embed],
        files: Files,
        allowedMentions: Pending.Tag?.AllowedMentions ?? { parse: [], roles: [] },
    });
    Context.Logger.Info('Embed sent with /sayembed', { StaffDiscordUserId: Interaction.user.id, GuildId: Interaction.guildId, ChannelId: Channel.id, MessageId: Sent.id, Tagged: Pending.Tag?.Content ?? null });
    await FinishSay(Interaction, Context, Sent, 'HandleSayEmbed');
}
