// npm run setup-db: creates the database and every table, then exits. The bot does the same on every start,
// so this is only needed to prepare the database before the first start (or to check the .env database settings).
import { ConfigurationError, LoadEnvironment } from './Config/Environment.js';
import { CreateDatabasePool, TestDatabaseConnection } from './Database/DatabaseConnection.js';
import { CreateSchema, EnsureDatabaseExists } from './Database/Schema.js';
import { Logger, RegisterSecretValues } from './Utils/Logger.js';

let Config;
try {
    Config = LoadEnvironment();
} catch (LoadError) {
    console.error(LoadError instanceof ConfigurationError ? LoadError.message : LoadError);
    process.exit(1);
}
RegisterSecretValues([Config.Database.User, Config.Database.Password].filter(Boolean));

let Pool;
try {
    await EnsureDatabaseExists(Config.Database, { Logger });
    Pool = CreateDatabasePool(Config.Database);
    await TestDatabaseConnection(Pool);
    await CreateSchema(Pool, { Logger });
    Logger.Info(`Database ${Config.Database.Name} is ready. Start the bot, then open the admin page to add your servers.`);
} catch (SetupError) {
    Logger.Error('Database setup failed', { Error: SetupError });
    process.exitCode = 1;
} finally {
    await Pool?.end();
}
