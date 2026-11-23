/**
 * Small in-memory fixed-window limiter for sensitive endpoints.
 * Entries are process-local, which is sufficient for a single API instance.
 */
export function createRateLimit({ name, windowMs = 60_000, max = 30 } = {}) {
  const buckets = new Map()

  return function rateLimit(req, res, next) {
    const now = Date.now()
    const ip =
      req.ip ||
      req.socket?.remoteAddress ||
      req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "unknown"
    let entry = buckets.get(ip)

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      buckets.set(ip, entry)
    }
    entry.count += 1

    if (buckets.size > 1000) {
      for (const [key, value] of buckets) {
        if (now >= value.resetAt) buckets.delete(key)
      }
    }

    res.setHeader("X-RateLimit-Limit", String(max))
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max - entry.count))
    )
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({
        message: `Too many ${name || "requests"}. Try again shortly.`,
      })
    }

    return next()
  }
}

export const jwtExchangeRateLimit = createRateLimit({
  name: "sign-in attempts",
  windowMs: 60_000,
  max: 30,
})

export const paymentVerifyRateLimit = createRateLimit({
  name: "payment checks",
  windowMs: 60_000,
  max: 60,
})
