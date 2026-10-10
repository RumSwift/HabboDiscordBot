import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, Events, GatewayIntentBits } from 'discord.js';

const EventsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'Events');

export function CreateDiscordClient() {
    return new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
}

export async function RegisterEvents(DiscordClient, EventContext) {
    const FileNames = (await readdir(EventsDirectory)).filter((FileName) => FileName.endsWith('.js')).sort();

    for (const FileName of FileNames) {
        const { default: Event } = await import(pathToFileURL(path.join(EventsDirectory, FileName)).href);
        if (!Event?.Name || typeof Event.Execute !== 'function') {
            throw new Error(`Invalid event file: ${FileName}`);
        }

        const Listener = async (...EventArguments) => {
            try {
                await Event.Execute(...EventArguments, EventContext);
            } catch (EventError) {
                EventContext.Logger.Error(`Unhandled error in event ${Event.Name}`, { Error: EventError });
            }
        };

        if (Event.Once) {
            DiscordClient.once(Event.Name, Listener);
        } else {
            DiscordClient.on(Event.Name, Listener);
        }
    }

    DiscordClient.on(Events.Error, (ClientError) => EventContext.Logger.Error('Discord client error', { Error: ClientError }));
    DiscordClient.on(Events.Warn, (Message) => EventContext.Logger.Warn(`Discord client warning: ${Message}`));
}

export async function LoginDiscordClient(DiscordClient, Token, { TimeoutMs = 60000 } = {}) {
    let TimeoutTimer;
    const ReadyPromise = new Promise((Resolve, Reject) => {
        DiscordClient.once(Events.ClientReady, Resolve);
        TimeoutTimer = setTimeout(() => Reject(new Error('Timed out waiting for the Discord client to become ready. Check the Server Members Intent is enabled.')), TimeoutMs);
    });
    try {
        await DiscordClient.login(Token);
        await ReadyPromise;
    } catch (LoginError) {
        if (LoginError?.code === 'DisallowedIntents' || /disallowed intents/i.test(String(LoginError?.message))) {
            throw new Error(
                'Discord refused the Server Members intent. Enable it in the developer portal (Bot -> Privileged Gateway Intents -> ' +
                    'Server Members Intent).',
                { cause: LoginError },
            );
        }
        throw LoginError;
    } finally {
        clearTimeout(TimeoutTimer);
    }
}
