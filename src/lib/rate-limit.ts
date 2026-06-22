/**
 * Simple in-memory rate limiter.
 * Works per-process (single instance). Fine for MVP on serverless — each warm
 * instance has its own counter, which is conservative (under-counts requests).
 * Replace with Redis/Upstash when multi-instance rate limiting is required.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune stale entries every 5 minutes to avoid unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

/**
 * Returns true when the request is allowed, false when the limit is exceeded.
 * @param key     Identifier — typically an IP address.
 * @param limit   Maximum requests allowed within the window.
 * @param windowMs Window duration in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

/** Extract a best-effort IP from Next.js request headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}
