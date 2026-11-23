import { Router } from "express"

import { getUsersCollection, isDBConnected } from "../config/db.js"
import { verifyToken } from "../middlewares/auth.middleware.js"
import { findUserForRequest, toPublicUser } from "../utils/user.js"
import { readBoundedText } from "../utils/validation.js"

const router = Router()
const PROFILE_FIELDS = ["name", "phone", "bio", "image"]
const FIELD_LIMITS = {
  name: 120,
  phone: 60,
  bio: 2000,
  image: 2048,
}

function collectProfileUpdates(body) {
  const updates = {}
  const source = body && typeof body === "object" ? body : {}

  for (const field of PROFILE_FIELDS) {
    if (!(field in source)) continue

    const value = source[field]
    if (value === null) {
      if (field === "name") return { error: "Name cannot be empty." }
      updates[field] = field === "image" ? null : ""
      continue
    }

    const trimmed = readBoundedText(value, FIELD_LIMITS[field])
    if (trimmed === null) {
      return { error: `${field} is invalid or too long.` }
    }
    if (field === "name" && !trimmed) {
      return { error: "Name cannot be empty." }
    }
    updates[field] = trimmed
  }

  return { updates }
}

router.get("/me", verifyToken, async (req, res, next) => {
  try {
    if (!isDBConnected()) {
      return res.status(503).json({ message: "Database is unavailable. Try again shortly." })
    }

    const user = await findUserForRequest(getUsersCollection(), req)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }
    return res.status(200).json(toPublicUser(user))
  } catch (error) {
    return next(error)
  }
})

async function updateProfile(req, res, next) {
  try {
    if (!isDBConnected()) {
      return res.status(503).json({ message: "Database is unavailable. Try again shortly." })
    }

    const { error, updates = {} } = collectProfileUpdates(req.body)
    if (error) return res.status(400).json({ message: error })
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No profile fields to update." })
    }

    const users = getUsersCollection()
    const current = await findUserForRequest(users, req)
    if (!current) {
      return res.status(404).json({ message: "User not found." })
    }

    await users.updateOne(
      { _id: current._id },
      { $set: { ...updates, updatedAt: new Date().toISOString() } }
    )
    const updated = await users.findOne({ _id: current._id })
    return res.status(200).json(toPublicUser(updated || current))
  } catch (error) {
    return next(error)
  }
}

router.patch("/profile", verifyToken, updateProfile)
router.put("/profile", verifyToken, updateProfile)

export default router
