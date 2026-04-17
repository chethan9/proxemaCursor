// Simple in-memory cache with TTL for browser-side data caching
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class BrowserCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs || this.defaultTTL,
    });
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

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear all entries for a specific prefix (e.g., "store:abc123")
  clearPrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
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