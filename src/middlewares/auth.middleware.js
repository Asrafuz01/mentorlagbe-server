import jwt from "jsonwebtoken"

import { getUsersCollection, isDBConnected } from "../config/db.js"
import { env } from "../config/env.js"
import { readCookies } from "../utils/cookies.js"
import { findUserForRequest, normalizePlan, normalizeRole } from "../utils/user.js"

const BEARER_TOKEN = /^Bearer\s+(.+)$/i
const VALID_ROLES = new Set(["student", "tutor", "admin"])

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
export async function verifyToken(req, res, next) {
  if (!env.jwtSecret) {
    return res.status(503).json({ message: "JWT_SECRET is not configured on the server." })
  }

  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ message: "Authentication required. No token provided." })
  }

  let decoded
  try {
    decoded = jwt.verify(token, env.jwtSecret)
    if (!decoded || typeof decoded !== "object") {
      throw new Error("Invalid token payload")
    }
  } catch (error) {
    const expired = error?.name === "TokenExpiredError"
    return res.status(401).json({
      message: expired
        ? "Token has expired. Please sign in again."
        : "Invalid or expired token.",
    })
  }

  req.user = {
    userId: decoded.userId || decoded.id || "",
    email: decoded.email || "",
    name: decoded.name || "",
    role: VALID_ROLES.has(decoded.role) ? decoded.role : "student",
    plan: normalizePlan(decoded.plan),
  }

  // Role and plan are server-owned; refresh them so admin/payment changes take
  // effect without waiting for the client's cached JWT to expire.
  if (isDBConnected()) {
    try {
      const user = await findUserForRequest(getUsersCollection(), req)
      if (!user) {
        return res.status(401).json({
          message: "This account no longer exists. Please sign in again.",
        })
      }
      req.user.userId = String(user._id)
      req.user.email = user.email || req.user.email
      req.user.name = user.name || req.user.name
      req.user.role = normalizeRole(user.role)
      req.user.plan = normalizePlan(user.plan)
    } catch {
      // Token claims remain usable if the profile lookup transiently fails.
    }
  }

  return next()
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
