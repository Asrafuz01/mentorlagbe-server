import { Router } from "express"

import { getUsersCollection, isDBConnected } from "../config/db.js"
import { env } from "../config/env.js"
import { signJwtToken } from "../middlewares/auth.middleware.js"
import { normalizeRole, toPublicUser } from "../utils/user.js"

const router = Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Finds the email's user, syncing a new record with safe role/plan defaults. */
router.post("/jwt", async (req, res, next) => {
  try {
    if (!env.jwtSecret) {
      return res
        .status(503)
        .json({ message: "JWT_SECRET is not configured on the server." })
    }
    if (!isDBConnected()) {
      return res.status(503).json({ message: "Database is unavailable. Try again shortly." })
    }

    const { email, name, role, image } = req.body || {}
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : ""
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ message: "A valid email is required." })
    }

    const providedName = typeof name === "string" ? name.trim() : ""
    const providedImage = typeof image === "string" ? image.trim() : ""
    const now = new Date().toISOString()
    const users = getUsersCollection()

    let user = await users.findOne({ email: normalizedEmail })
    if (!user) {
      const result = await users.insertOne({
        email: normalizedEmail,
        name: providedName || normalizedEmail.split("@")[0],
        role: normalizeRole(role),
        plan: "free",
        ...(providedImage ? { image: providedImage } : {}),
        createdAt: now,
        updatedAt: now,
      })
      user = await users.findOne({ _id: result.insertedId })
    } else if (providedName || providedImage) {
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            ...(providedName ? { name: providedName } : {}),
            ...(providedImage ? { image: providedImage } : {}),
            updatedAt: now,
          },
        }
      )
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
      plan: user.plan || "free",
    })

    return res.status(200).json({ token, user: toPublicUser(user) })
  } catch (error) {
    return next(error)
  }
})

export default router
