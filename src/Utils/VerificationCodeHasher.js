import { createHmac, timingSafeEqual } from 'node:crypto';

export function HashVerificationCode(Code, Secret) {
    if (!Secret) {
        throw new Error('A verification code secret is required.');
    }
    return createHmac('sha256', Secret).update(String(Code), 'utf8').digest('hex');
}

export function VerifyCodeHash(Candidate, StoredHash, Secret) {
    if (typeof Candidate !== 'string' || typeof StoredHash !== 'string') {
        return false;
    }
    const CandidateHash = Buffer.from(HashVerificationCode(Candidate, Secret), 'hex');
    const ExpectedHash = Buffer.from(StoredHash, 'hex');
    if (CandidateHash.length !== ExpectedHash.length) {
        return false;
    }
    return timingSafeEqual(CandidateHash, ExpectedHash);
}
