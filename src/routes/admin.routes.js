import { Router } from "express"

import {
  getPaymentsCollection,
  getTuitionsCollection,
  getUsersCollection,
  isDBConnected,
} from "../config/db.js"
import { verifyAdmin, verifyToken } from "../middlewares/auth.middleware.js"
import { findById, hasValidId } from "../utils/ids.js"
import { toPublicUser } from "../utils/user.js"

const router = Router()
const ROLES = new Set(["student", "tutor", "admin"])
const APPROVAL_STATUSES = new Set(["approved", "rejected"])

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function dateString(value, fallback = "") {
  if (value === null || value === undefined) return fallback
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

function serializeUser(user) {
  return {
    ...toPublicUser(user),
    emailVerified: Boolean(user.emailVerified),
    location: text(user.location),
  }
}

function serializeTuition(tuition) {
  return {
    ...tuition,
    _id: String(tuition._id),
    createdAt: dateString(tuition.createdAt),
    updatedAt: dateString(tuition.updatedAt),
  }
}

function serializePayment(payment) {
  return {
    ...payment,
    _id: String(payment._id),
    plan: payment.plan || "free",
    currency: text(payment.currency, "USD").toUpperCase(),
    status: payment.status || "pending",
    createdAt: dateString(payment.createdAt),
    updatedAt: dateString(payment.updatedAt),
  }
}

router.use(verifyToken, verifyAdmin)

router.use((_req, res, next) => {
  if (!isDBConnected()) {
    return res.status(503).json({ message: "Database is unavailable. Try again shortly." })
  }
  return next()
})

router.get("/users", async (_req, res, next) => {
  try {
    const users = (await getUsersCollection().find({}).sort({ createdAt: -1 }).toArray())
      .map(serializeUser)

    return res.status(200).json({ data: users, users, total: users.length })
  } catch (error) {
    return next(error)
  }
})

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id." })
    }

    const role = text(req.body?.role).toLowerCase()
    if (!ROLES.has(role)) {
      return res
        .status(400)
        .json({ message: "Role must be student, tutor, or admin." })
    }

    const users = getUsersCollection()
    const user = await findById(users, req.params.id)
    if (!user) {
      return res.status(404).json({ message: "User not found." })
    }

    await users.updateOne(
      { _id: user._id },
      { $set: { role, updatedAt: new Date().toISOString() } }
    )
    const updated = await users.findOne({ _id: user._id })
    const payload = serializeUser(updated || user)
    return res.status(200).json({ ...payload, user: payload })
  } catch (error) {
    return next(error)
  }
})

router.get("/tuitions", async (_req, res, next) => {
  try {
    const tuitions = (
      await getTuitionsCollection().find({}).sort({ createdAt: -1, _id: -1 }).toArray()
    ).map(serializeTuition)

    return res.status(200).json({
      data: tuitions,
      tuitions,
      total: tuitions.length,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch("/tuitions/:id/status", async (req, res, next) => {
  try {
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid tuition id." })
    }

    const approvalStatus = text(req.body?.approvalStatus).toLowerCase()
    if (!APPROVAL_STATUSES.has(approvalStatus)) {
      return res
        .status(400)
        .json({ message: "approvalStatus must be approved or rejected." })
    }

    const tuitions = getTuitionsCollection()
    const tuition = await findById(tuitions, req.params.id)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }

    await tuitions.updateOne(
      { _id: tuition._id },
      { $set: { approvalStatus, updatedAt: new Date() } }
    )
    const updated = await tuitions.findOne({ _id: tuition._id })
    const payload = serializeTuition(updated || tuition)
    return res.status(200).json({ ...payload, tuition: payload })
  } catch (error) {
    return next(error)
  }
})

router.get("/transactions", async (_req, res, next) => {
  try {
    const transactions = (
      await getPaymentsCollection().find({}).sort({ createdAt: -1, _id: -1 }).toArray()
    ).map(serializePayment)

    return res.status(200).json({
      data: transactions,
      payments: transactions,
      transactions,
      total: transactions.length,
    })
  } catch (error) {
    return next(error)
  }
})

router.get("/stats", async (_req, res, next) => {
  try {
    const users = getUsersCollection()
    const tuitions = getTuitionsCollection()
    const payments = getPaymentsCollection()

    const [totalUsers, totalTutors, pendingTuitions, approvedTuitions, revenue] =
      await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ role: "tutor" }),
        tuitions.countDocuments({ approvalStatus: "pending" }),
        tuitions.countDocuments({ approvalStatus: "approved" }),
        payments
          .aggregate([
            { $match: { status: "completed" } },
            {
              $group: {
                _id: null,
                total: { $sum: { $ifNull: ["$amount", 0] } },
              },
            },
          ])
          .toArray(),
      ])

    const stats = {
      totalUsers,
      totalTutors,
      pendingTuitions,
      approvedTuitions,
      totalStripeRevenue: Number(revenue[0]?.total) || 0,
    }

    return res.status(200).json({ data: stats, stats, ...stats })
  } catch (error) {
    return next(error)
  }
})

export default router
