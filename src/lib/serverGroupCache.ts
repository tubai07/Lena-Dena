// High-performance server-side in-memory cache for group data

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const summaryCache = new Map<string, CacheEntry<any>>();
const detailCache = new Map<string, CacheEntry<any>>();

const SUMMARY_TTL_MS = 15000; // 15 seconds
const DETAIL_TTL_MS = 15000;  // 15 seconds

export function getCachedServerSummary(businessId: string) {
  const entry = summaryCache.get(businessId);
  if (entry && Date.now() - entry.timestamp < SUMMARY_TTL_MS) {
    return entry.data;
  }
  return null;
}

export function setCachedServerSummary(businessId: string, data: any) {
  summaryCache.set(businessId, { data, timestamp: Date.now() });
}

export function invalidateServerSummary(businessId?: string) {
  if (businessId) {
    summaryCache.delete(businessId);
  } else {
    summaryCache.clear();
  }
}

export function getCachedServerDetail(groupId: string) {
  const entry = detailCache.get(groupId);
  if (entry && Date.now() - entry.timestamp < DETAIL_TTL_MS) {
    return entry.data;
  }
  return null;
}

export function setCachedServerDetail(groupId: string, data: any) {
  detailCache.set(groupId, { data, timestamp: Date.now() });
}

export function invalidateServerDetail(groupId?: string) {
  if (groupId) {
    detailCache.delete(groupId);
  } else {
    detailCache.clear();
  }
}

export function invalidateAllGroupServerCaches(groupId?: string, businessId?: string) {
  if (groupId) detailCache.delete(groupId);
  if (businessId) summaryCache.delete(businessId);
  if (!groupId && !businessId) {
    detailCache.clear();
    summaryCache.clear();
  }
}
