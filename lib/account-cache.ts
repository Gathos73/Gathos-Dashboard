import { createHash } from "node:crypto";

type Entry<T> = { expires: number; promise: Promise<T | null> };

// Bounded, process-local presentation cache. Never use it for API authorization.
export function createAccountCache<T>(ttlMs = 30_000, maxEntries = 500, now = Date.now) {
  const entries = new Map<string, Entry<T>>();
  const keyFor = (token: string) => createHash("sha256").update(token).digest("hex");
  return {
    invalidate(token: string) { entries.delete(keyFor(token)); },
    read(token: string, loader: () => Promise<T | null>, enabled = true): Promise<T | null> {
      if (!enabled) return loader();
      const key = keyFor(token);
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return cached.promise;
      const entry: Entry<T> = { expires: now() + ttlMs, promise: Promise.resolve(null) };
      // Starting the TTL before loading bounds staleness even with slow requests.
      entry.promise = Promise.resolve().then(loader).then((value) => {
        if (value === null && entries.get(key) === entry) entries.delete(key);
        return value;
      }).catch((error: unknown) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.delete(key);
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
      entries.set(key, entry);
      return entry.promise;
    },
  };
}
