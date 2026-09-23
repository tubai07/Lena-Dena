// Server-side cache helper: in serverless environments (Vercel), memory is partitioned across
// instances so caching dynamic relational data creates stale reads. Always query PostgreSQL directly.

export function getCachedServerSummary(_businessId: string) {
  return null;
}

export function setCachedServerSummary(_businessId: string, _data: any) {
  // No-op
}

export function invalidateServerSummary(_businessId?: string) {
  // No-op
}

export function getCachedServerDetail(_groupId: string) {
  return null;
}

export function setCachedServerDetail(_groupId: string, _data: any) {
  // No-op
}

export function invalidateServerDetail(_groupId?: string) {
  // No-op
}

export function invalidateAllGroupServerCaches(_groupId?: string, _businessId?: string) {
  // No-op
}

