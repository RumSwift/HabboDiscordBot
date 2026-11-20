import { GetHotel } from '../Utils/HotelConfiguration.js';

export const HabboLookupStatuses = Object.freeze({
    Found: 'FOUND',
    NotFound: 'NOT_FOUND',
    Unavailable: 'UNAVAILABLE',
});

const MaxRetryAfterWaitMs = 5000;

const DefaultSleep = (Milliseconds) => new Promise((Resolve) => setTimeout(Resolve, Milliseconds));

export class HabboApiService {
    constructor({ TimeoutMs = 10000, MaxRetries = 2, FetchFunction = globalThis.fetch, Sleep = DefaultSleep, Logger, Clock = () => Date.now() } = {}) {
        this.TimeoutMs = TimeoutMs;
        this.MaxRetries = MaxRetries;
        this.FetchFunction = FetchFunction;
        this.Sleep = Sleep;
        this.Logger = Logger;
        this.Clock = Clock;
        this.RateLimitedUntilByHost = new Map();
    }

    async LookupUserByName(HotelCode, Username) {
        const Hotel = GetHotel(HotelCode);
        const Url = `https://${Hotel.Hostname}/api/public/users?name=${encodeURIComponent(Username)}`;
        return this.RequestUser(Hotel.Hostname, Url, null);
    }

    async LookupUserByUniqueId(HotelCode, HabboUniqueId) {
        const Hotel = GetHotel(HotelCode);
        const Url = `https://${Hotel.Hostname}/api/public/users/${encodeURIComponent(HabboUniqueId)}`;
        return this.RequestUser(Hotel.Hostname, Url, HabboUniqueId);
    }

    async RequestUser(Hostname, Url, ExpectedUniqueId) {
        const RateLimitedUntil = this.RateLimitedUntilByHost.get(Hostname) ?? 0;
        if (RateLimitedUntil > this.Clock()) {
            return Unavailable('RATE_LIMITED', Math.ceil((RateLimitedUntil - this.Clock()) / 1000));
        }

        let LastResult = Unavailable('NETWORK_ERROR');

        for (let Attempt = 0; Attempt <= this.MaxRetries; Attempt++) {
            const { Result, RetryDelayMs } = await this.RequestOnce(Hostname, Url, ExpectedUniqueId);
            LastResult = Result;

            const ShouldRetry = Result.Status === HabboLookupStatuses.Unavailable && RetryDelayMs !== null && Attempt < this.MaxRetries;
            if (!ShouldRetry) {
                return Result;
            }

            this.Logger?.Debug('Retrying Habbo API request', { Hostname, Attempt: Attempt + 1, Reason: Result.Reason });
            await this.Sleep(RetryDelayMs);
        }

        return LastResult;
    }

    async RequestOnce(Hostname, Url, ExpectedUniqueId) {
        const BackoffMs = 500;

        let Response;
        try {
            Response = await this.FetchFunction(Url, {
                method: 'GET',
                headers: { Accept: 'application/json', 'User-Agent': 'HabboVerifyBot/1.0' },
                signal: AbortSignal.timeout(this.TimeoutMs),
            });
        } catch (RequestError) {
            const IsTimeout = RequestError?.name === 'TimeoutError' || RequestError?.name === 'AbortError';
            this.Logger?.Warn('Habbo API request failed', { Hostname, Reason: IsTimeout ? 'TIMEOUT' : 'NETWORK_ERROR', Error: RequestError });
            return { Result: Unavailable(IsTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'), RetryDelayMs: BackoffMs };
        }

        const Body = await ReadJsonBody(Response);

        if (Response.status === 200) {
            const Account = ParseAccount(Body);
            if (!Account || (ExpectedUniqueId && Account.HabboUniqueId !== ExpectedUniqueId)) {
                this.Logger?.Warn('Habbo API returned an unexpected user payload', { Hostname });
                return { Result: Unavailable('UNEXPECTED_RESPONSE'), RetryDelayMs: null };
            }
            return { Result: { Status: HabboLookupStatuses.Found, Account }, RetryDelayMs: null };
        }

        if (Response.status === 404 && Body?.error === 'not-found') {
            return { Result: { Status: HabboLookupStatuses.NotFound }, RetryDelayMs: null };
        }

        if (Response.status === 400 && Array.isArray(Body?.errors) && Body.errors.some((Item) => Item?.param === 'name')) {
            return { Result: { Status: HabboLookupStatuses.NotFound }, RetryDelayMs: null };
        }

        if (Response.status === 429) {
            const RetryAfterMs = ParseRetryAfterMs(Response.headers?.get?.('retry-after'), this.Clock()) ?? 2000;
            this.RateLimitedUntilByHost.set(Hostname, this.Clock() + RetryAfterMs);
            this.Logger?.Warn('Habbo API rate limit hit', { Hostname, RetryAfterMs });
            const CanWait = RetryAfterMs <= MaxRetryAfterWaitMs;
            if (CanWait) {
                this.RateLimitedUntilByHost.delete(Hostname);
            }
            return {
                Result: Unavailable('RATE_LIMITED', Math.ceil(RetryAfterMs / 1000)),
                RetryDelayMs: CanWait ? RetryAfterMs : null,
            };
        }

        if (Response.status >= 500) {
            this.Logger?.Warn('Habbo API server error', { Hostname, HttpStatus: Response.status });
            return { Result: Unavailable('SERVER_ERROR'), RetryDelayMs: BackoffMs };
        }

        this.Logger?.Warn('Habbo API returned an unexpected status', { Hostname, HttpStatus: Response.status });
        return { Result: Unavailable('UNEXPECTED_RESPONSE'), RetryDelayMs: null };
    }
}

function Unavailable(Reason, RetryAfterSeconds = null) {
    return { Status: HabboLookupStatuses.Unavailable, Reason, RetryAfterSeconds };
}

async function ReadJsonBody(Response) {
    try {
        return await Response.json();
    } catch {
        return null;
    }
}

function ParseAccount(Body) {
    if (!Body || typeof Body !== 'object' || typeof Body.uniqueId !== 'string' || typeof Body.name !== 'string' || !Body.uniqueId) {
        return null;
    }
    return {
        HabboUniqueId: Body.uniqueId,
        Username: Body.name,
        Motto: typeof Body.motto === 'string' ? Body.motto : null,
        ProfileVisible: Body.profileVisible !== false,
    };
}

export function ParseRetryAfterMs(HeaderValue, NowMs = Date.now()) {
    if (!HeaderValue) {
        return null;
    }
    const Seconds = Number(HeaderValue);
    if (Number.isFinite(Seconds) && Seconds >= 0) {
        return Seconds * 1000;
    }
    const DateMs = Date.parse(HeaderValue);
    if (Number.isFinite(DateMs)) {
        return Math.max(0, DateMs - NowMs);
    }
    return null;
}
