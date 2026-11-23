import { Router } from "express"

import {
  getTuitionsCollection,
  getUsersCollection,
  isDBConnected,
} from "../config/db.js"
import { verifyToken, verifyTutor } from "../middlewares/auth.middleware.js"
import { findById, hasValidId } from "../utils/ids.js"
import { findUserForRequest } from "../utils/user.js"

const router = Router()
const DEFAULT_LIMIT = 9
const MAX_LIMIT = 50
const FREE_PLAN_LIMIT = 2

const EDITABLE_FIELDS = [
  "title",
  "subject",
  "classLevel",
  "mode",
  "location",
  "monthlyFee",
  "daysPerWeek",
  "bannerImage",
  "description",
  "isActive",
]

const databaseUnavailable = (res) =>
  res.status(503).json({ message: "Database is unavailable. Try again shortly." })

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeMode(value) {
  const mode = text(value).toLowerCase()
  return mode === "online" || mode === "offline"
    ? mode[0].toUpperCase() + mode.slice(1)
    : null
}

function isProPlan(plan) {
  return plan === "pro" || plan === "tutor-pro"
}

/** Bearer auth is required only when a caller asks for scoped/all-status tuitions. */
function verifyScopedAccess(req, res, next) {
  const scoped = Boolean(
    req.query.tutorId || req.query.tutorEmail || req.query.mine === "true"
  )
  return scoped ? verifyToken(req, res, next) : next()
}

function isScopedRequest(req) {
  return Boolean(req.query.tutorId || req.query.tutorEmail || req.query.mine === "true")
}

function scopedCondition(req) {
  const tutorId = text(req.query.tutorId)
  const tutorEmail = text(req.query.tutorEmail)
  const email = text(req.user?.email).toLowerCase()
  const userId = text(req.user?.userId)

  if (req.query.mine === "true" || (!tutorId && !tutorEmail)) {
    const clauses = []
    if (email) clauses.push({ tutorEmail: email })
    if (userId) clauses.push({ tutorId: userId })
    return { condition: clauses.length ? { $or: clauses } : { _id: null } }
  }

  if (tutorEmail) {
    if (tutorEmail.toLowerCase() !== email && req.user?.role !== "admin") {
      return { forbidden: true }
    }
    return { condition: { tutorEmail: tutorEmail.toLowerCase() } }
  }

  if (tutorId !== userId && req.user?.role !== "admin") {
    return { forbidden: true }
  }
  return { condition: { tutorId } }
}

function buildFilter(req) {
  const conditions = []

  if (isScopedRequest(req)) {
    const { condition, forbidden } = scopedCondition(req)
    if (forbidden) return { forbidden: true }
    conditions.push(condition)
  } else {
    conditions.push({ approvalStatus: "approved" }, { isActive: true })
  }

  const search = text(req.query.search)
  if (search) {
    const pattern = escapeRegex(search)
    conditions.push({
      $or: [
        { title: { $regex: pattern, $options: "i" } },
        { subject: { $regex: pattern, $options: "i" } },
      ],
    })
  }

  const subject = text(req.query.subject)
  if (subject) {
    conditions.push({ subject: { $regex: escapeRegex(subject), $options: "i" } })
  }

  const classLevel = text(req.query.classLevel)
  if (classLevel) {
    conditions.push({
      classLevel: { $regex: escapeRegex(classLevel), $options: "i" },
    })
  }

  const mode = normalizeMode(req.query.mode)
  if (mode) conditions.push({ mode })

  return { filter: conditions.length ? { $and: conditions } : {} }
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const requested = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT
  return { page, limit: Math.min(MAX_LIMIT, Math.max(1, requested)) }
}

function isOwner(tuition, user) {
  if (!user) return false
  if (user.role === "admin") return true

  const email = text(user.email).toLowerCase()
  if (email && text(tuition.tutorEmail).toLowerCase() === email) return true

  const userId = text(user.userId)
  return Boolean(userId && text(tuition.tutorId) === userId)
}

function normalizeUpdate(field, value) {
  if (field === "mode") return normalizeMode(value) || "Online"
  if (field === "monthlyFee" || field === "daysPerWeek") {
    return Number(value) || 0
  }
  if (field === "isActive") return value === true || value === "true"
  return text(value)
}

router.get("/", verifyScopedAccess, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const { filter, forbidden } = buildFilter(req)
    if (forbidden) {
      return res
        .status(403)
        .json({ message: "You can only view your own tuition listings." })
    }
    if (isScopedRequest(req) && req.user?.role !== "tutor" && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Tutor access only." })
    }

    const { page, limit } = pagination(req.query)
    const collection = getTuitionsCollection()
    const [tuitions, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ])

    return res.status(200).json({
      data: tuitions,
      tuitions,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get("/:id", async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition id." })
    }

    const tuition = await findById(getTuitionsCollection(), req.params.id)
    if (
      !tuition ||
      text(tuition.approvalStatus).toLowerCase() !== "approved" ||
      tuition.isActive === false
    ) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    return res.status(200).json(tuition)
  } catch (error) {
    return next(error)
  }
})

router.post("/", verifyToken, verifyTutor, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const body = req.body || {}
    const title = text(body.title)
    if (!title) {
      return res.status(400).json({ message: "Tuition title is required." })
    }

    const tutorEmail = text(req.user.email) || text(body.tutorEmail)
    const tutorName = text(req.user.name) || text(body.tutorName)
    const users = getUsersCollection()
    const tuitions = getTuitionsCollection()
    const account = await findUserForRequest(users, req)
    const plan = account?.plan || req.user.plan || "free"

    const ownerClauses = [
      ...(tutorEmail ? [{ tutorEmail }] : []),
      ...(req.user.userId ? [{ tutorId: req.user.userId }] : []),
    ]
    const tuitionCount = ownerClauses.length
      ? await tuitions.countDocuments({ $or: ownerClauses })
      : 0

    if (!isProPlan(plan) && tuitionCount >= FREE_PLAN_LIMIT) {
      return res.status(403).json({
        message:
          "Free Plan allows up to 2 tuitions. Upgrade to Pro to publish more listings.",
      })
    }

    const now = new Date()
    const tuition = {
      title,
      subject: text(body.subject) || "General",
      classLevel: text(body.classLevel) || "All levels",
      mode: normalizeMode(body.mode) || "Online",
      location: text(body.location) || "Online",
      monthlyFee: Number(body.monthlyFee) || 0,
      daysPerWeek: Number(body.daysPerWeek) || 0,
      bannerImage: text(body.bannerImage),
      description: text(body.description),
      approvalStatus: "pending",
      isActive: true,
      tutorEmail,
      tutorName,
      tutorId: req.user.userId || "",
      createdAt: now,
      updatedAt: now,
    }

    const result = await tuitions.insertOne(tuition)
    return res.status(201).json({ ...tuition, _id: result.insertedId })
  } catch (error) {
    return next(error)
  }
})

async function updateTuition(req, res, next) {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition id." })
    }

    const tuitions = getTuitionsCollection()
    const tuition = await findById(tuitions, req.params.id)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    if (!isOwner(tuition, req.user)) {
      return res
        .status(403)
        .json({ message: "You can only edit your own tuition listings." })
    }

    const updates = {}
    for (const field of EDITABLE_FIELDS) {
      if (req.body && field in req.body) {
        updates[field] = normalizeUpdate(field, req.body[field])
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No tuition fields to update." })
    }
    if (text(tuition.approvalStatus).toLowerCase() === "rejected") {
      updates.approvalStatus = "pending"
    }

    await tuitions.updateOne(
      { _id: tuition._id },
      { $set: { ...updates, updatedAt: new Date() } }
    )
    const updated = await tuitions.findOne({ _id: tuition._id })
    return res.status(200).json(updated)
  } catch (error) {
    return next(error)
  }
}

async function deleteTuition(req, res, next) {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition id." })
    }

    const tuitions = getTuitionsCollection()
    const tuition = await findById(tuitions, req.params.id)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    if (!isOwner(tuition, req.user)) {
      return res
        .status(403)
        .json({ message: "You can only delete your own tuition listings." })
    }

    await tuitions.deleteOne({ _id: tuition._id })
    return res.status(200).json({ message: "Tuition deleted.", id: String(tuition._id) })
  } catch (error) {
    return next(error)
  }
}

router.patch("/:id", verifyToken, verifyTutor, updateTuition)
router.put("/:id", verifyToken, verifyTutor, updateTuition)
router.delete("/:id", verifyToken, verifyTutor, deleteTuition)

export default router
