import jwt from "jsonwebtoken"

import { env } from "../config/env.js"

const BEARER_TOKEN = /^Bearer\s+(.+)$/i
const VALID_ROLES = new Set(["student", "tutor", "admin"])

/** Express does not parse cookies by default, so read them from the raw header. */
function readCookies(req) {
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

function extractToken(req) {
  const authorization = req.headers?.authorization
  if (typeof authorization === "string") {
    const match = BEARER_TOKEN.exec(authorization.trim())
    if (match) return match[1].trim()
  }

  const headerToken = req.headers?.["x-auth-token"]
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim()
  }

  const cookieToken = readCookies(req).token
  return typeof cookieToken === "string" && cookieToken.trim()
    ? cookieToken.trim()
    : null
}

/** Creates a signed token carrying the identity fields used across the API. */
export function signJwtToken(payload) {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured. Add it to .env to issue tokens.")
  }
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" })
}

/** Authenticates Bearer, x-auth-token, or cookie tokens and populates req.user. */
export function verifyToken(req, res, next) {
  if (!env.jwtSecret) {
    return res.status(503).json({ message: "JWT_SECRET is not configured on the server." })
  }

  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ message: "Authentication required. No token provided." })
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload")
    }

    req.user = {
      userId: decoded.userId || decoded.id || "",
      email: decoded.email || "",
      name: decoded.name || "",
      role: VALID_ROLES.has(decoded.role) ? decoded.role : "student",
      plan: decoded.plan || "free",
    }
    return next()
  } catch (error) {
    const expired = error?.name === "TokenExpiredError"
    return res.status(401).json({
      message: expired
        ? "Token has expired. Please sign in again."
        : "Invalid or expired token.",
    })
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: `${role} access only.` })
    }
    return next()
  }
}

export const verifyStudent = requireRole("student")
export const verifyTutor = requireRole("tutor")
export const verifyAdmin = requireRole("admin")
