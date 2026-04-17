// Enhanced browser cache with SWR (stale-while-revalidate) pattern
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type FetcherFn<T> = () => Promise<T>;
type Subscriber<T> = (data: T) => void;

class BrowserCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private subscribers: Map<string, Set<Subscriber<unknown>>> = new Map();
  private pendingFetches: Map<string, Promise<unknown>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  // Basic set/get operations
  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs || this.defaultTTL,
    });
    // Notify subscribers
    this.notifySubscribers(key, data);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Get even if stale (for SWR pattern)
  getStale<T>(key: string): { data: T | null; isStale: boolean } {
    const entry = this.cache.get(key);
    if (!entry) return { data: null, isStale: true };

    const isStale = Date.now() - entry.timestamp > entry.ttl;
    return { data: entry.data as T, isStale };
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  // SWR Pattern: Get cached data immediately, revalidate in background
  async swr<T>(
    key: string,
    fetcher: FetcherFn<T>,
    options?: { ttl?: number; forceRefresh?: boolean }
  ): Promise<{ data: T; fromCache: boolean }> {
    const ttl = options?.ttl || this.defaultTTL;
    const forceRefresh = options?.forceRefresh || false;

    // Check cache first
    const { data: cachedData, isStale } = this.getStale<T>(key);

    // If we have fresh cached data and not forcing refresh, return immediately
    if (cachedData !== null && !isStale && !forceRefresh) {
      return { data: cachedData, fromCache: true };
    }

    // If we have stale data, return it but trigger background refresh
    if (cachedData !== null && !forceRefresh) {
      // Background refresh (don't await)
      this.fetchAndCache(key, fetcher, ttl);
      return { data: cachedData, fromCache: true };
    }

    // No cached data or force refresh - must fetch
    const freshData = await this.fetchAndCache(key, fetcher, ttl);
    return { data: freshData, fromCache: false };
  }

  // Deduplicated fetch with caching
  private async fetchAndCache<T>(
    key: string,
    fetcher: FetcherFn<T>,
    ttl: number
  ): Promise<T> {
    // Check if there's already a pending fetch for this key
    const pending = this.pendingFetches.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Create new fetch promise
    const fetchPromise = fetcher()
      .then((data) => {
        this.set(key, data, ttl);
        this.pendingFetches.delete(key);
        return data;
      })
      .catch((error) => {
        this.pendingFetches.delete(key);
        throw error;
      });

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  // Prefetch data in background
  prefetch<T>(key: string, fetcher: FetcherFn<T>, ttl?: number): void {
    // Only prefetch if not already cached
    if (!this.has(key)) {
      this.fetchAndCache(key, fetcher, ttl || this.defaultTTL).catch(() => {
        // Silently fail prefetch
      });
    }
  }

  // Subscribe to cache updates
  subscribe<T>(key: string, callback: Subscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback as Subscriber<unknown>);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback as Subscriber<unknown>);
    };
  }

  private notifySubscribers<T>(key: string, data: T): void {
    this.subscribers.get(key)?.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error("Cache subscriber error:", e);
      }
    });
  }

  // Get cache stats for debugging
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const browserCache = new BrowserCache();

// Cache keys constants
export const CACHE_KEYS = {
  STORES: "stores",
  CLIENTS: "clients",
  DASHBOARD_STATS: "dashboard:stats",
  SYNC_RUNS: "sync_runs",
  WEBHOOKS: "webhooks",
  store: (id: string) => `store:${id}`,
  storeProducts: (id: string) => `store:${id}:products`,
  storeOrders: (id: string) => `store:${id}:orders`,
  storeCustomers: (id: string) => `store:${id}:customers`,
  storeSyncRuns: (id: string) => `store:${id}:sync_runs`,
  storeWebhooks: (id: string) => `store:${id}:webhooks`,
  storeWebhookEvents: (id: string) => `store:${id}:webhook_events`,
  storeCronLogs: (id: string) => `store:${id}:cron_logs`,
  storeDataCounts: (id: string) => `store:${id}:data_counts`,
};

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 30 * 1000,      // 30 seconds - for frequently changing data
  MEDIUM: 2 * 60 * 1000, // 2 minutes - for moderately changing data
  LONG: 5 * 60 * 1000,   // 5 minutes - for stable data
  EXTENDED: 15 * 60 * 1000, // 15 minutes - for rarely changing data
};

// Custom hook helper for SWR pattern
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}