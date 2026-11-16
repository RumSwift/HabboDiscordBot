import { AttachmentBuilder, channelMention, escapeMarkdown, FileBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';
import { Colours, Emojis, FormatEmoji } from '../../Components/ComponentStyles.js';
import { LogChannelTypes } from '../../Repositories/GuildConfigurationRepository.js';
import { BuildLogCard, FormatCodeBlock } from './LogCard.js';

const MaxContentLength = 2800; // leaves room for the rest of the card within Discord's 4000-character total
const MaxGalleryItems = 10; // Discord limit
const MaxFilesPerMessage = 10; // Discord limit
const DownloadTimeoutMs = 15000;
const MegaByte = 1024 * 1024;
// Discord's upload limit per server boost tier.
const UploadLimitBytes = { 0: 10 * MegaByte, 1: 10 * MegaByte, 2: 50 * MegaByte, 3: 100 * MegaByte };

export function FormatContentBlock(Content) {
    return FormatCodeBlock(Content, MaxContentLength);
}

function FormatSize(Bytes) {
    return `${(Bytes / MegaByte).toFixed(1)} MB`;
}

// Numbered so names are unique; SPOILER_ must stay at the front for Discord to keep the file hidden.
function SafeFileName(Index, Name) {
    const Clean = String(Name ?? 'file').replace(/[^\w.-]/g, '_');
    const IsSpoiler = Clean.startsWith('SPOILER_');
    return `${IsSpoiler ? 'SPOILER_' : ''}${Index + 1}_${IsSpoiler ? Clean.slice(8) : Clean}`;
}

// Discord removes a deleted message's files, so they are downloaded straight away and re-uploaded with the log.
// LimitBytes overrides the server's upload limit (e.g. DMs, which always allow 10 MB).
export async function SaveAttachments(Message, { Fetch = fetch, LimitBytes = null } = {}) {
    let BytesLeft = LimitBytes ?? UploadLimitBytes[Message.guild?.premiumTier ?? 0] ?? UploadLimitBytes[0];
    const Results = [];
    for (const [Index, Attachment] of [...(Message.attachments?.values() ?? [])].entries()) {
        const FileName = SafeFileName(Index, Attachment.name);
        const Result = {
            Name: Attachment.name,
            FileName,
            IsMedia: /^(image|video)\//.test(Attachment.contentType ?? ''),
            IsSpoiler: FileName.startsWith('SPOILER_'),
            Buffer: null,
            Problem: null,
        };
        Results.push(Result);
        if (Index >= MaxFilesPerMessage) {
            Result.Problem = 'too many files';
        } else if (Attachment.size > BytesLeft) {
            Result.Problem = `too large (${FormatSize(Attachment.size)})`;
        } else {
            Result.Buffer = await Download(Fetch, [Attachment.proxyURL, Attachment.url]);
            if (Result.Buffer) {
                BytesLeft -= Result.Buffer.length;
            } else {
                Result.Problem = 'Discord had already removed it';
            }
        }
    }
    return Results;
}

async function Download(Fetch, Urls) {
    for (const Url of Urls.filter(Boolean)) {
        try {
            const Response = await Fetch(Url, { signal: AbortSignal.timeout(DownloadTimeoutMs) });
            if (Response.ok) {
                return Buffer.from(await Response.arrayBuffer());
            }
        } catch {
            // Try the next URL.
        }
    }
    return null;
}

export function BuildMessageDeletedCard(Message, { SavedAttachments = [], Now = new Date() } = {}) {
    const Stickers = [...(Message.stickers?.values() ?? [])];
    const Fields = [
        { Label: 'Channel', Value: channelMention(Message.channelId) },
        { Label: 'Content', Value: Message.content ? FormatContentBlock(Message.content) : '*No text*' },
    ];
    if (Stickers.length > 0) {
        Fields.push({ Label: 'Stickers', Value: Stickers.map((Sticker) => escapeMarkdown(Sticker.name)).join(', ') });
    }
    const NotSaved = SavedAttachments.filter((Saved) => Saved.Problem);
    if (NotSaved.length > 0) {
        Fields.push({ Label: 'Not saved', Value: NotSaved.map((Saved) => `${escapeMarkdown(Saved.Name)} · *${Saved.Problem}*`).join('\n') });
    }

    // Saved images and videos, then stickers and linked GIF/image previews, whose links outlive the message.
    const GalleryItems = SavedAttachments.filter((Saved) => Saved.Buffer && Saved.IsMedia).map((Saved) =>
        new MediaGalleryItemBuilder().setURL(`attachment://${Saved.FileName}`).setSpoiler(Saved.IsSpoiler),
    );
    const LinkedUrls = [...Stickers.map((Sticker) => Sticker.url), ...(Message.embeds ?? []).map((LinkEmbed) => LinkEmbed.image?.url ?? LinkEmbed.thumbnail?.url)].filter(Boolean);
    GalleryItems.push(...LinkedUrls.map((Url) => new MediaGalleryItemBuilder().setURL(Url)));
    const OtherFiles = SavedAttachments.filter((Saved) => Saved.Buffer && !Saved.IsMedia);

    return BuildLogCard({
        Title: `${FormatEmoji(Emojis.Deleted)} Message Deleted`,
        User: Message.author,
        Colour: Colours.Danger,
        Fields,
        AddExtras: (Card) => {
            if (GalleryItems.length > 0) {
                Card.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(GalleryItems.slice(0, MaxGalleryItems)));
            }
            if (OtherFiles.length > 0) {
                Card.addFileComponents(OtherFiles.map((Saved) => new FileBuilder().setURL(`attachment://${Saved.FileName}`).setSpoiler(Saved.IsSpoiler)));
            }
        },
        FooterNotes: [`Message ID: ${Message.id}`],
        Now,
    });
}

export class MessageDeleteLogService {
    constructor({ GuildLogService, Fetch = fetch }) {
        this.GuildLogService = GuildLogService;
        this.Fetch = Fetch;
    }

    async HandleMessageDelete(Message) {
        // Uncached messages have no author or content; bot messages are skipped to keep the log readable.
        if (Message.partial || !Message.guildId || !Message.author || Message.author.bot) {
            return false;
        }
        return this.GuildLogService.Send({
            GuildId: Message.guildId,
            ChannelType: LogChannelTypes.MessageDelete,
            SourceChannel: Message.channel,
            Build: async () => {
                const SavedAttachments = await SaveAttachments(Message, { Fetch: this.Fetch });
                return {
                    Card: BuildMessageDeletedCard(Message, { SavedAttachments }),
                    Files: SavedAttachments.filter((Saved) => Saved.Buffer).map((Saved) => new AttachmentBuilder(Saved.Buffer, { name: Saved.FileName })),
                };
            },
        });
    }
}
