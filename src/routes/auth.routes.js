import { Router } from "express"

import { getUsersCollection, isDBConnected } from "../config/db.js"
import { env } from "../config/env.js"
import { signJwtToken } from "../middlewares/auth.middleware.js"
import { jwtExchangeRateLimit } from "../middlewares/rate-limit.js"
import {
  canUseDevJwtFallback,
  verifyBetterAuthSession,
} from "../utils/better-auth-session.js"
import { readBoundedText } from "../utils/validation.js"
import { normalizePlan, normalizeRole, parseRole, toPublicUser } from "../utils/user.js"

const router = Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME_LENGTH = 120
const MAX_IMAGE_LENGTH = 2048

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function devIdentityFromBody(body) {
  const email = text(body.email).toLowerCase()
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: { status: 400, message: "A valid email is required." } }
  }

  const name = readBoundedText(body.name, MAX_NAME_LENGTH)
  const image = readBoundedText(body.image, MAX_IMAGE_LENGTH)
  if (name === null || image === null) {
    return {
      error: {
        status: 400,
        message: "Name or image is too long.",
      },
    }
  }

  return {
    identity: {
      email,
      name: name || email.split("@")[0],
      image,
      role: parseRole(body.role),
      plan: null,
      isDevFallback: true,
    },
  }
}

/** Exchanges a verified BetterAuth session for a scoped Express JWT. */
router.post("/jwt", jwtExchangeRateLimit, async (req, res, next) => {
  try {
    if (!env.jwtSecret) {
      return res
        .status(503)
        .json({ message: "JWT_SECRET is not configured on the server." })
    }
    if (!isDBConnected()) {
      return res.status(503).json({ message: "Database is unavailable. Try again shortly." })
    }

    const body = req.body && typeof req.body === "object" ? req.body : {}
    const sessionResult = await verifyBetterAuthSession(req)
    let identity = sessionResult.identity
    let usedDevFallback = false

    if (!identity) {
      if (!canUseDevJwtFallback()) {
        return res.status(sessionResult.error.status).json({
          message: sessionResult.error.message,
        })
      }

      const fallback = devIdentityFromBody(body)
      if (fallback.error) {
        return res.status(fallback.error.status).json({ message: fallback.error.message })
      }
      identity = fallback.identity
      usedDevFallback = true
    }

    // A stale or mismatched client email must never override the session owner.
    const requestedEmail = text(body.email).toLowerCase()
    if (requestedEmail && requestedEmail !== identity.email) {
      return res.status(403).json({
        message: "The signed-in account does not match the requested identity.",
      })
    }

    const now = new Date().toISOString()
    const users = getUsersCollection()
    const providedName = text(identity.name)
    const providedImage = text(identity.image)
    const roleHint = parseRole(identity.role) || parseRole(body.role)
    let user = await users.findOne({ email: identity.email })

    if (!user) {
      const result = await users.insertOne({
        email: identity.email,
        name: providedName || identity.email.split("@")[0],
        // Admin and plan are server-owned; a hint can only choose student/tutor
        // for a brand-new profile, including the local dev fallback.
        role: roleHint && roleHint !== "admin" ? roleHint : "student",
        plan: "free",
        ...(providedImage ? { image: providedImage } : {}),
        createdAt: now,
        updatedAt: now,
      })
      user = await users.findOne({ _id: result.insertedId })
    } else {
      // Role and plan are server-owned after creation. Only profile fields may
      // be synced here; role changes go through the admin API.
      const update = { updatedAt: now }
      if (providedName) update.name = providedName
      if (providedImage) update.image = providedImage

      await users.updateOne({ _id: user._id }, { $set: update })
      user = await users.findOne({ _id: user._id })
    }

    if (!user) {
      return res.status(500).json({ message: "Could not sync the user record." })
    }

    const token = signJwtToken({
      userId: String(user._id),
      email: user.email,
      name: user.name || "",
      role: normalizeRole(user.role),
      plan: normalizePlan(user.plan),
    })

    return res.status(200).json({
      token,
      user: toPublicUser(user),
      ...(usedDevFallback
        ? { devFallback: true }
        : {}),
    })
  } catch (error) {
    return next(error)
  }
})

export default router
