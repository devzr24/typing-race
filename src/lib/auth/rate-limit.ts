export function createRateLimiter(now: () => number = Date.now) {
  const entries = new Map<string, { attempts: number; expiresAt: number }>();
  let lastPurge = -Infinity;

  function purge(time = now()): void {
    if (time - lastPurge < 1_000) return;
    lastPurge = time;
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= time) entries.delete(key);
    }
  }

  return {
    purge,
    get size() {
      return entries.size;
    },
    isLimited(key: string, limit: number): boolean {
      const entry = entries.get(key);
      return !!entry && entry.expiresAt > now() && entry.attempts >= limit;
    },
    reset(key: string): void {
      entries.delete(key);
    },
    consume(key: string, limit: number, windowMs: number): boolean {
      const time = now();
      purge(time);
      const entry = entries.get(key);
      if (entry && entry.expiresAt > time) {
        if (entry.attempts >= limit) return false;
        entry.attempts++;
      } else {
        entries.set(key, { attempts: 1, expiresAt: time + windowMs });
      }
      return true;
    },
  };
}

export function clientIp(headers: Pick<Headers, "get">): string {
  return headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || headers.get("x-real-ip")?.trim()
    || "local";
}

const RATE_LIMIT_KEY = Symbol.for("typing-race.auth-rate-limit");
type GlobalWithRateLimiter = typeof globalThis & {
  [RATE_LIMIT_KEY]?: ReturnType<typeof createRateLimiter>;
};

// Partagé entre les modules serveur et conservé lors du rechargement à chaud.
export const authRateLimiter = (globalThis as GlobalWithRateLimiter)[RATE_LIMIT_KEY]
  ??= createRateLimiter();
