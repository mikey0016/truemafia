interface Bucket {
  count: number;
  resetAt: number;
}

/** Simple fixed-window in-memory rate limiter (per key). */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [k, b] of this.buckets) {
        if (b.resetAt < now) this.buckets.delete(k);
      }
    }, 60_000);
    this.timer.unref();
  }

  /** Returns true if allowed. */
  check(key: string, maxPerMinute: number): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + 60_000 };
      this.buckets.set(key, b);
    }
    b.count++;
    return b.count <= maxPerMinute;
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
  }
}
