import { randomInt } from 'node:crypto';

// No 0/O or 1/I/L, which are easily confused.
export const VerificationCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function GenerateVerificationCode({ Prefix = 'DISC-', Length = 6 } = {}) {
    let RandomPart = '';
    for (let Index = 0; Index < Length; Index++) {
        RandomPart += VerificationCodeAlphabet[randomInt(VerificationCodeAlphabet.length)];
    }
    return `${Prefix}${RandomPart}`;
}
