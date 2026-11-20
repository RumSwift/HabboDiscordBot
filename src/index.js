import { LoadEnvironment, ConfigurationError } from './Config/Environment.js';
import { Logger, RegisterSecretValues, SetLogLevel } from './Utils/Logger.js';
import { Application } from './Application.js';

let RunningApplication = null;
let IsShuttingDown = false;

async function Main() {
    let Config;
    try {
        Config = LoadEnvironment();
    } catch (LoadError) {
        if (LoadError instanceof ConfigurationError) {
            console.error(LoadError.message);
            process.exit(1);
        }
        throw LoadError;
    }

    SetLogLevel(Config.LogLevel);
    RegisterSecretValues([Config.Database.User, Config.Database.Password, Config.Discord.Token, Config.Api.InternalApiKey, Config.Verification.CodeSecret, Config.Admin.Password].filter(Boolean));

    RunningApplication = new Application({ Config, Logger });
    try {
        await RunningApplication.Start();
    } catch (StartupError) {
        Logger.Error('HabboVerifyBot failed to start', { Error: StartupError });
        process.exit(1);
    }
}

async function Shutdown(SignalName) {
    if (IsShuttingDown) {
        return;
    }
    IsShuttingDown = true;
    Logger.Info(`Received ${SignalName}; shutting down...`);

    setTimeout(() => {
        Logger.Error('Shutdown took too long; forcing exit.');
        process.exit(1);
    }, 15000).unref();

    try {
        await RunningApplication?.Stop();
        process.exit(0);
    } catch (ShutdownError) {
        Logger.Error('Error during shutdown', { Error: ShutdownError });
        process.exit(1);
    }
}

process.on('SIGINT', () => Shutdown('SIGINT'));
process.on('SIGTERM', () => Shutdown('SIGTERM'));
process.on('unhandledRejection', (Reason) => Logger.Error('Unhandled promise rejection', { Error: Reason }));

Main().catch((FatalError) => {
    Logger.Error('Fatal error', { Error: FatalError });
    process.exit(1);
});
