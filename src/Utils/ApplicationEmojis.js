import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EmojiAssetsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'emojis');

const Registry = new Map();

export function ApplicationEmoji(Name, DefaultId, Fallback) {
    Registry.set(Name, { Id: DefaultId, Fallback });
    return Object.freeze({
        get name() {
            return Registry.get(Name).Id ? Name : Fallback;
        },
        get id() {
            return Registry.get(Name).Id ?? undefined;
        },
    });
}

export function SetApplicationEmojiId(Name, Id) {
    const Entry = Registry.get(Name);
    if (Entry) {
        Entry.Id = Id ?? null;
    }
}

export function GetApplicationEmojiNames() {
    return [...Registry.keys()];
}

export function FormatEmoji(Emoji) {
    return Emoji.id ? `<:${Emoji.name}:${Emoji.id}>` : Emoji.name;
}

export async function SyncApplicationEmojis(Client, { Logger, AssetsDirectory = EmojiAssetsDirectory } = {}) {
    const Names = GetApplicationEmojiNames();
    let Existing;
    try {
        Existing = await Client.application.emojis.fetch();
    } catch (FetchError) {
        Logger?.Warn('Could not read the bot application emojis; using plain emojis instead', { Error: FetchError });
        Names.forEach((Name) => SetApplicationEmojiId(Name, null));
        return;
    }
    const Uploaded = [];
    for (const Name of Names) {
        const Found = Existing.find((Emoji) => Emoji.name === Name);
        if (Found) {
            SetApplicationEmojiId(Name, Found.id);
            continue;
        }
        try {
            const Created = await Client.application.emojis.create({ attachment: path.join(AssetsDirectory, `${Name}.png`), name: Name });
            SetApplicationEmojiId(Name, Created.id);
            Uploaded.push(Name);
        } catch (CreateError) {
            SetApplicationEmojiId(Name, null);
            Logger?.Warn(`Could not upload the ${Name} emoji; using a plain emoji instead`, { Error: CreateError });
        }
    }
    if (Uploaded.length > 0) {
        Logger?.Info(`Uploaded ${Uploaded.length} emoji(s) to the bot application: ${Uploaded.join(', ')}.`);
    }
}
