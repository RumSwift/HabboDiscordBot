const LogLevels = { debug: 10, info: 20, warn: 30, error: 40 };

const SensitiveKeyPattern = /(password|token|secret|apikey|api_key|authorization|verificationcode|codehash)/i;

let CurrentLevel = LogLevels.info;

export function SetLogLevel(LevelName) {
    const Level = LogLevels[String(LevelName).toLowerCase()];
    if (Level === undefined) {
        throw new Error(`Unknown log level: ${LevelName}`);
    }
    CurrentLevel = Level;
}

export function SanitiseContext(Context) {
    if (!Context || typeof Context !== 'object') {
        return Context;
    }
    const Result = {};
    for (const [Key, Value] of Object.entries(Context)) {
        if (SensitiveKeyPattern.test(Key)) {
            Result[Key] = '[REDACTED]';
        } else if (Value instanceof Error) {
            Result[Key] = { Name: Value.name, Message: Value.message, Code: Value.code };
        } else {
            Result[Key] = Value;
        }
    }
    return Result;
}

// Exact secret values (e.g. the DB username/password) that must never appear in output,
// even inside third-party error messages such as "Access denied for user '...'".
const SecretValues = new Set();

export function RegisterSecretValues(Values) {
    for (const Value of Values) {
        if (typeof Value === 'string' && Value.length >= 4) {
            SecretValues.add(Value);
        }
    }
}

export function MaskSecretValues(Text) {
    let Masked = Text;
    for (const Value of SecretValues) {
        Masked = Masked.split(Value).join('[REDACTED]');
    }
    return Masked;
}

function Write(LevelName, Message, Context) {
    if (LogLevels[LevelName] < CurrentLevel) {
        return;
    }
    const Line = MaskSecretValues(`${new Date().toISOString()} [${LevelName.toUpperCase()}] ${Message}`);
    const SafeContext = SanitiseContext(Context);
    const Output = LevelName === 'error' || LevelName === 'warn' ? console.error : console.log;
    if (SafeContext && Object.keys(SafeContext).length > 0) {
        Output(Line, MaskSecretValues(JSON.stringify(SafeContext)));
    } else {
        Output(Line);
    }
}

export const Logger = {
    Debug: (Message, Context) => Write('debug', Message, Context),
    Info: (Message, Context) => Write('info', Message, Context),
    Warn: (Message, Context) => Write('warn', Message, Context),
    Error: (Message, Context) => Write('error', Message, Context),
};

export const SilentLogger = {
    Debug: () => {},
    Info: () => {},
    Warn: () => {},
    Error: () => {},
};
