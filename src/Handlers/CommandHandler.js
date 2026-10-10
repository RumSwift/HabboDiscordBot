import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';

const DefaultCommandsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'Commands');

export async function LoadCommands({ Logger, CommandsDirectory = DefaultCommandsDirectory } = {}) {
    const Commands = new Map();
    const ComponentHandlers = new Map();
    const ModalHandlers = new Map();

    const FileNames = (await readdir(CommandsDirectory)).filter((FileName) => FileName.endsWith('.js')).sort();

    for (const FileName of FileNames) {
        let Command;
        try {
            const Module = await import(pathToFileURL(path.join(CommandsDirectory, FileName)).href);
            Command = Module.default;
        } catch (ImportError) {
            Logger?.Error(`Could not load command file ${FileName}; skipping it`, { Error: ImportError });
            continue;
        }

        const Problem = ValidateCommand(Command);
        if (Problem) {
            Logger?.Error(`Invalid command file ${FileName}: ${Problem}; skipping it`);
            continue;
        }

        const CommandName = Command.Data.name;
        if (Commands.has(CommandName)) {
            throw new Error(`Duplicate slash command name "${CommandName}" in ${FileName}.`);
        }
        Commands.set(CommandName, Command);

        RegisterHandlers(ComponentHandlers, Command.ComponentHandlers, FileName, 'component');
        RegisterHandlers(ModalHandlers, Command.ModalHandlers, FileName, 'modal');

        Logger?.Debug(`Loaded command /${CommandName} from ${FileName}`);
    }

    Logger?.Info(`Loaded ${Commands.size} slash command(s): ${[...Commands.keys()].map((Name) => `/${Name}`).join(', ')}`);
    return { Commands, ComponentHandlers, ModalHandlers };
}

export function ValidateCommand(Command) {
    if (!Command || typeof Command !== 'object') {
        return 'it must have a default export object';
    }
    if (!Command.Data || typeof Command.Data.toJSON !== 'function' || !Command.Data.name) {
        return 'Data must be a SlashCommandBuilder with a name';
    }
    if (typeof Command.Execute !== 'function') {
        return 'Execute must be a function';
    }
    for (const Key of ['ComponentHandlers', 'ModalHandlers']) {
        const Handlers = Command[Key];
        if (Handlers === undefined) {
            continue;
        }
        if (typeof Handlers !== 'object' || Object.values(Handlers).some((Handler) => typeof Handler !== 'function')) {
            return `${Key} must be an object of functions`;
        }
    }
    return null;
}

function RegisterHandlers(TargetMap, Handlers, FileName, Kind) {
    for (const [Action, Handler] of Object.entries(Handlers ?? {})) {
        if (TargetMap.has(Action)) {
            throw new Error(`Duplicate ${Kind} handler action "${Action}" in ${FileName}.`);
        }
        TargetMap.set(Action, Handler);
    }
}

export async function RegisterGlobalCommands({ Commands, Token, ClientId, Logger, Rest = new REST({ version: '10' }).setToken(Token) }) {
    const Body = [...Commands.values()].map((Command) => Command.Data.toJSON());
    const Registered = await Rest.put(Routes.applicationCommands(ClientId), { body: Body });
    Logger?.Info(`Registered ${Body.length} global slash command(s) with Discord.`);
    return Registered;
}
