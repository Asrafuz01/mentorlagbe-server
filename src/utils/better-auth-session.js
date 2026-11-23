import { createHmac, timingSafeEqual } from "node:crypto"

import { ObjectId } from "mongodb"

import {
  getAuthSessionsCollection,
  getAuthUsersCollection,
  isDBConnected,
} from "../config/db.js"
import { env } from "../config/env.js"
import { readCookies } from "./cookies.js"
import { parsePlan, parseRole } from "./user.js"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSION_COOKIE_SUFFIX = ".session_token"

function text(value) {
  if (typeof value === "string") return value.trim()
  if (value instanceof ObjectId) return value.toHexString()
  if (
    value &&
    typeof value === "object" &&
    typeof value.toHexString === "function"
  ) {
    return String(value.toHexString()).trim()
  }
  return ""
}

function decodeIfNeeded(value) {
  if (typeof value !== "string") return ""
  if (!value.includes("%")) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toObjectId(value) {
  if (!/^[a-f\d]{24}$/i.test(value)) return null
  try {
    return new ObjectId(value)
  } catch {
    return null
  }
}

function sessionCookieNames() {
  const prefix = text(env.betterAuthCookiePrefix) || "better-auth"
  const name = `${prefix}${SESSION_COOKIE_SUFFIX}`
  return [`__Secure-${name}`, name, `__Host-${name}`]
}

function failure(status, message) {
  return { error: { status, message } }
}

/**
 * Verifies the HMAC signature BetterAuth appends to signed cookie values:
 * `<sessionToken>.<base64 HMAC-SHA256>`.
 */
export function verifySignedCookieValue(rawValue, secret) {
  const value = decodeIfNeeded(rawValue)
  if (!value || !secret) return null

  const separator = value.lastIndexOf(".")
  if (separator < 1) return null

  const signedValue = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  if (signature.length !== 44 || !signature.endsWith("=")) return null

  const expected = createHmac("sha256", secret)
    .update(signedValue)
    .digest("base64")
  const receivedBuffer = Buffer.from(signature, "base64")
  const expectedBuffer = Buffer.from(expected, "base64")

  if (receivedBuffer.length !== expectedBuffer.length) return null
  return timingSafeEqual(receivedBuffer, expectedBuffer) ? signedValue : null
}

function isExpired(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return !Number.isFinite(timestamp) || timestamp <= Date.now()
}

async function findAuthUser(userId) {
  if (!userId) return null

  const objectId = toObjectId(userId)
  const clauses = [{ _id: userId }, { id: userId }]
  if (objectId) clauses.unshift({ _id: objectId })

  return getAuthUsersCollection().findOne({ $or: clauses })
}

/**
 * Derives the caller identity from a valid BetterAuth session cookie and the
 * matching `session`/`user` records. No identity is taken from the request body.
 */
export async function verifyBetterAuthSession(req) {
  if (!env.betterAuthSecret) {
    return failure(
      503,
      "BetterAuth session verification is not configured on the server."
    )
  }
  if (!isDBConnected()) {
    return failure(503, "Database is unavailable. Try again shortly.")
  }

  const cookies = readCookies(req)
  const rawCookie = sessionCookieNames()
    .map((name) => cookies[name])
    .find(Boolean)
  if (!rawCookie) {
    return failure(401, "A valid BetterAuth session is required. Please sign in again.")
  }

  const sessionToken = verifySignedCookieValue(rawCookie, env.betterAuthSecret)
  if (!sessionToken) {
    return failure(401, "A valid BetterAuth session is required. Please sign in again.")
  }

  const session = await getAuthSessionsCollection().findOne(
    { token: sessionToken },
    { projection: { token: 1, userId: 1, expiresAt: 1 } }
  )
  if (!session || isExpired(session.expiresAt)) {
    return failure(401, "Your session has expired. Please sign in again.")
  }

  const authUser = await findAuthUser(text(session.userId))
  const email = text(authUser?.email).toLowerCase()
  if (!authUser || !EMAIL_PATTERN.test(email)) {
    return failure(401, "The account for this session is no longer available.")
  }

  return {
    identity: {
      email,
      name: text(authUser.name) || email.split("@")[0],
      image: text(authUser.image),
      role: parseRole(authUser.role),
      plan: parsePlan(authUser.plan),
      authUserId: String(authUser._id || authUser.id || ""),
      sessionUserId: text(session.userId),
    },
  }
}

/** Explicit, non-production escape hatch for the documented seed/admin flow. */
export function canUseDevJwtFallback() {
  return (
    !env.isProduction &&
    env.allowDevJwtWithoutSession &&
    Boolean(env.jwtSecret) &&
    isDBConnected()
  )
}
