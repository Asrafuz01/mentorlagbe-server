/** Parses the raw Cookie header into a plain object for server-side helpers. */
export function readCookies(req) {
  if (req.cookies && typeof req.cookies === "object") return req.cookies

  const header = req.headers?.cookie
  if (typeof header !== "string" || !header.trim()) return {}

  const cookies = {}
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=")
    if (separator < 0) continue

    const key = entry.slice(0, separator).trim()
    const rawValue = entry.slice(separator + 1).trim()
    if (!key) continue

    try {
      cookies[key] = decodeURIComponent(rawValue)
    } catch {
      cookies[key] = rawValue
    }
  }
  return cookies
}
