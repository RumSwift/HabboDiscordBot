export const MaxDeliveryAttempts = 10;

export function CalculateBackoffMs(AttemptCount, BaseMs = 30000, MaxMs = 3600000) {
    const Exponent = Math.max(0, AttemptCount - 1);
    return Math.min(MaxMs, BaseMs * 2 ** Exponent);
}

const PermanentDiscordErrorCodes = new Set([
    10003,
    10007,
    10011,
    10013,
    50035,
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
