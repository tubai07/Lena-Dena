// Lightweight in-memory & sessionStorage cache for 0ms instantaneous UI renders

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

export function getCachedItem<T>(key: string): T | null {
  // Check memory
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.data;
  }

  // Check sessionStorage if available in browser
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`ld_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  return null;
}

export function setCachedItem<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  memoryCache.set(key, entry);

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`ld_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function invalidateCacheItem(key: string): void {
  memoryCache.delete(key);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`ld_cache_${key}`);
    } catch {
      // Ignore
    }
  }
}
