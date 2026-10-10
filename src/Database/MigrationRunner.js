import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DefaultMigrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'Migrations');
const MigrationLockName = 'HabboVerifyBot_Migrations';

export async function RunMigrations(Pool, { Logger, MigrationsDirectory = DefaultMigrationsDirectory } = {}) {
    const Connection = await Pool.getConnection();
    try {
        // Stops two bot processes migrating at the same time.
        const [LockRows] = await Connection.query('SELECT GET_LOCK(?, 30) AS Acquired', [MigrationLockName]);
        if (LockRows[0].Acquired !== 1) {
            throw new Error('Could not acquire the migration lock (another instance may be migrating).');
        }

        try {
            await Connection.query(`
                CREATE TABLE IF NOT EXISTS SchemaMigrations (
                    MigrationName VARCHAR(255) NOT NULL PRIMARY KEY,
                    AppliedTimestamp DATETIME(3) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
            `);

            const [AppliedRows] = await Connection.query('SELECT MigrationName FROM SchemaMigrations');
            const AppliedNames = new Set(AppliedRows.map((Row) => Row.MigrationName));

            const MigrationFiles = (await readdir(MigrationsDirectory)).filter((FileName) => FileName.endsWith('.js')).sort();

            const NewlyApplied = [];
            for (const FileName of MigrationFiles) {
                const MigrationName = path.basename(FileName, '.js');
                if (AppliedNames.has(MigrationName)) {
                    continue;
                }

                const Migration = await import(pathToFileURL(path.join(MigrationsDirectory, FileName)).href);
                if (typeof Migration.Up !== 'function') {
                    throw new Error(`Migration ${FileName} does not export an Up function.`);
                }

                Logger?.Info(`Applying migration ${MigrationName}`);
                await Migration.Up(Connection);
                await Connection.query('INSERT INTO SchemaMigrations (MigrationName, AppliedTimestamp) VALUES (?, ?)', [MigrationName, new Date()]);
                NewlyApplied.push(MigrationName);
            }

            Logger?.Info(NewlyApplied.length > 0 ? `Applied ${NewlyApplied.length} migration(s).` : 'Database schema is up to date.');
            return NewlyApplied;
        } finally {
            await Connection.query('SELECT RELEASE_LOCK(?)', [MigrationLockName]);
        }
    } finally {
        Connection.release();
    }
}
