interface DedupeEntry<T> {
  promise?: Promise<T>;
  value?: T;
  expiresAt: number;
}

interface DedupeOptions {
  readonly force?: boolean;
  readonly cacheMs?: number;
}

const entries = new Map<string, DedupeEntry<unknown>>();
const DEFAULT_CACHE_MS = 800;

export function requestWithDedupe<T>(
  key: string,
  loader: () => Promise<T>,
  options: DedupeOptions = {},
): Promise<T> {
  const now = Date.now();
  const cacheMs = options.cacheMs ?? DEFAULT_CACHE_MS;
  const existing = entries.get(key) as DedupeEntry<T> | undefined;

  if (!options.force && existing) {
    if (existing.promise) {
      return existing.promise;
    }
    if ('value' in existing && existing.expiresAt > now) {
      return Promise.resolve(existing.value as T);
    }
  }

  const entry: DedupeEntry<T> = { expiresAt: 0 };
  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + cacheMs;
      return value;
    })
    .finally(() => {
      const current = entries.get(key);
      if (current !== entry) {
        return;
      }

      delete entry.promise;
      if (!('value' in entry)) {
        entries.delete(key);
        return;
      }

      window.setTimeout(() => {
        const latest = entries.get(key);
        if (latest === entry && entry.expiresAt <= Date.now()) {
          entries.delete(key);
        }
      }, cacheMs + 100);
    });

  entry.promise = promise;
  entries.set(key, entry as DedupeEntry<unknown>);
  return promise;
}
