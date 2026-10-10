export class RateLimiter {
    constructor({ Limit, WindowMs, Clock = () => Date.now() }) {
        this.Limit = Limit;
        this.WindowMs = WindowMs;
        this.Clock = Clock;
        this.TimestampsByKey = new Map();
    }

    TryConsume(Key) {
        const Now = this.Clock();
        const RecentTimestamps = (this.TimestampsByKey.get(Key) ?? []).filter((Timestamp) => Now - Timestamp < this.WindowMs);

        if (RecentTimestamps.length >= this.Limit) {
            this.TimestampsByKey.set(Key, RecentTimestamps);
            return false;
        }

        RecentTimestamps.push(Now);
        this.TimestampsByKey.set(Key, RecentTimestamps);
        this.PruneIfLarge(Now);
        return true;
    }

    PruneIfLarge(Now) {
        if (this.TimestampsByKey.size < 5000) {
            return;
        }
        for (const [Key, Timestamps] of this.TimestampsByKey) {
            if (Timestamps.every((Timestamp) => Now - Timestamp >= this.WindowMs)) {
                this.TimestampsByKey.delete(Key);
            }
        }
    }
}
