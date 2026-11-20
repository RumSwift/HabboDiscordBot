import { createHash, timingSafeEqual } from 'node:crypto';

export const ApiKeyHeaderName = 'X-Internal-API-Key';

export function CreateInternalApiAuthentication(InternalApiKey) {
    const ExpectedDigest = createHash('sha256').update(InternalApiKey, 'utf8').digest();

    return function InternalApiAuthentication(Request, Response, Next) {
        const ProvidedKey = Request.get(ApiKeyHeaderName);
        if (typeof ProvidedKey !== 'string' || ProvidedKey.length === 0) {
            return SendUnauthorised(Response);
        }
        const ProvidedDigest = createHash('sha256').update(ProvidedKey, 'utf8').digest();
        if (!timingSafeEqual(ProvidedDigest, ExpectedDigest)) {
            return SendUnauthorised(Response);
        }
        return Next();
    };
}

function SendUnauthorised(Response) {
    return Response.status(401).json({ Success: false, Error: { Code: 'UNAUTHORISED', Message: `A valid ${ApiKeyHeaderName} header is required.` } });
}
