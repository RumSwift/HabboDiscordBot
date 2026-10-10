export const MaxDeliveryAttempts = 10;

export function CalculateBackoffMs(AttemptCount, BaseMs = 30000, MaxMs = 3600000) {
    const Exponent = Math.max(0, AttemptCount - 1);
    return Math.min(MaxMs, BaseMs * 2 ** Exponent);
}

// Discord API error codes that will never succeed on retry.
// https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
const PermanentDiscordErrorCodes = new Set([
    10003, // Unknown Channel (thread deleted / wrong ID)
    10007, // Unknown Member (user left the server)
    10011, // Unknown Role
    10013, // Unknown User
    50035, // Invalid Form Body
]);

export class PermanentError extends Error {
    constructor(Message) {
        super(Message);
        this.name = 'PermanentError';
        this.IsPermanent = true;
    }
}

export function IsPermanentFailure(FailureError) {
    if (FailureError?.IsPermanent) {
        return true;
    }
    return PermanentDiscordErrorCodes.has(FailureError?.code);
}

export function DescribeError(FailureError) {
    if (!FailureError) {
        return 'Unknown error';
    }
    const Code = FailureError.code !== undefined ? ` (code ${FailureError.code})` : '';
    return `${FailureError.name ?? 'Error'}: ${FailureError.message ?? String(FailureError)}${Code}`.slice(0, 1000);
}
