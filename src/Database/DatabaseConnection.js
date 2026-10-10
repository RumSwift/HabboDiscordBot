import mysql from 'mysql2/promise';

export function CreateDatabasePool(DatabaseConfig) {
    const Pool = mysql.createPool({
        host: DatabaseConfig.Host,
        port: DatabaseConfig.Port,
        user: DatabaseConfig.User,
        password: DatabaseConfig.Password,
        database: DatabaseConfig.Name,
        // All timestamps are stored and read as UTC.
        timezone: 'Z',
        charset: 'utf8mb4',
        connectionLimit: 10,
        connectTimeout: 10000,
        waitForConnections: true,
        // BIGINT IDs are returned as strings so large values are never rounded.
        supportBigNumbers: true,
        bigNumberStrings: true,
    });

    // 'connection' gives us the underlying (callback-style) connection.
    Pool.pool.on('connection', (Connection) => {
        Connection.query("SET time_zone = '+00:00'");
    });

    return Pool;
}

export async function TestDatabaseConnection(Pool) {
    await Pool.query('SELECT 1');
}

const DeadlockErrorCodes = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

export async function WithTransaction(Pool, Work, { MaxDeadlockRetries = 2 } = {}) {
    for (let Attempt = 0; ; Attempt++) {
        const Connection = await Pool.getConnection();
        try {
            await Connection.beginTransaction();
            const Result = await Work(Connection);
            await Connection.commit();
            return Result;
        } catch (TransactionError) {
            await Connection.rollback().catch(() => {});
            if (DeadlockErrorCodes.has(TransactionError.code) && Attempt < MaxDeadlockRetries) {
                continue;
            }
            throw TransactionError;
        } finally {
            Connection.release();
        }
    }
}

export function IsDuplicateKeyError(DatabaseError) {
    return DatabaseError?.code === 'ER_DUP_ENTRY';
}
