import { Router } from "express"

import {
  getBookmarksCollection,
  getTuitionsCollection,
  getUsersCollection,
  isDBConnected,
} from "../config/db.js"
import { verifyStudent, verifyToken } from "../middlewares/auth.middleware.js"
import { canSaveMore, FREE_BOOKMARK_LIMIT } from "../utils/bookmark-utils.js"
import { findById, hasValidId } from "../utils/ids.js"
import { findUserForRequest } from "../utils/user.js"
import { readBoundedText } from "../utils/validation.js"

const router = Router()
const MAX_TUITION_ID_LENGTH = 255

const databaseUnavailable = (res) =>
  res.status(503).json({ message: "Database is unavailable. Try again shortly." })

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function isSavableTuition(tuition) {
  return Boolean(
    tuition &&
      text(tuition.approvalStatus).toLowerCase() === "approved" &&
      tuition.isActive !== false
  )
}

function serializeBookmark(bookmark, tuition = null) {
  return {
    ...bookmark,
    _id: String(bookmark._id),
    tuitionId: text(bookmark.tuitionId),
    tuition: tuition ? { ...tuition, _id: String(tuition._id) } : null,
  }
}

// Only signed-in students may save tuitions. All handlers are scoped to the
// email on the verified JWT, so a caller cannot read or remove another user's list.
router.use(verifyToken, verifyStudent)
router.use((_req, res, next) =>
  isDBConnected() ? next() : databaseUnavailable(res)
)

/** Returns the student's saved tuitions with the joined, current tuition data. */
router.get("/", async (req, res, next) => {
  try {
    const studentEmail = text(req.user.email).toLowerCase()
    const bookmarks = await getBookmarksCollection()
      .find({ studentEmail })
      .sort({ createdAt: -1, _id: -1 })
      .toArray()

    const tuitions = getTuitionsCollection()
    const items = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const tuition = await findById(tuitions, text(bookmark.tuitionId))
        return serializeBookmark(bookmark, tuition)
      })
    )

    const visible = items.filter((item) => item.tuition !== null)
    return res.status(200).json({
      data: visible,
      bookmarks: visible,
      savedTuitions: visible,
      total: visible.length,
    })
  } catch (error) {
    return next(error)
  }
})

/** Saves a tuition. Re-saving is idempotent; free plans are capped. */
router.post("/", async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {}
    const tuitionId = readBoundedText(body.tuitionId, MAX_TUITION_ID_LENGTH)
    if (tuitionId === null) {
      return res.status(400).json({ message: "tuitionId is invalid." })
    }
    if (!tuitionId) {
      return res.status(400).json({ message: "tuitionId is required." })
    }

    const tuition = await findById(getTuitionsCollection(), tuitionId)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    if (!isSavableTuition(tuition)) {
      return res.status(409).json({
        message: "This tuition is not currently available to save.",
      })
    }

    const storedTuitionId = String(tuition._id)
    const studentEmail = text(req.user.email).toLowerCase()
    const bookmarks = getBookmarksCollection()
    const filter = { studentEmail, tuitionId: storedTuitionId }

    const existing = await bookmarks.findOne(filter)
    if (existing) {
      return res.status(200).json({
        ...serializeBookmark(existing, tuition),
        alreadySaved: true,
      })
    }

    const account = await findUserForRequest(getUsersCollection(), req)
    const plan = account?.plan || req.user.plan || "free"
    const savedCount = await bookmarks.countDocuments({ studentEmail })
    if (!canSaveMore(plan, savedCount)) {
      return res.status(403).json({
        message: `Free Plan allows up to ${FREE_BOOKMARK_LIMIT} saved tuitions. Upgrade to Pro to save more.`,
      })
    }

    const now = new Date()
    const bookmark = {
      tuitionId: storedTuitionId,
      studentId: req.user.userId || "",
      studentEmail,
      tuitionTitle: text(tuition.title),
      subject: text(tuition.subject),
      createdAt: now,
      updatedAt: now,
    }

    try {
      const result = await bookmarks.insertOne(bookmark)
      return res.status(201).json(serializeBookmark({ ...bookmark, _id: result.insertedId }, tuition))
    } catch (error) {
      // A concurrent double-click can race the duplicate check above.
      if (error?.code === 11000) {
        const saved = await bookmarks.findOne(filter)
        if (saved) {
          return res.status(200).json({
            ...serializeBookmark(saved, tuition),
            alreadySaved: true,
          })
        }
      }
      throw error
    }
  } catch (error) {
    return next(error)
  }
})

/** Removes one saved tuition by its tuition id. */
router.delete("/:tuitionId", async (req, res, next) => {
  try {
    if (!hasValidId(req.params.tuitionId)) {
      return res.status(400).json({ message: "Invalid tuition id." })
    }

    const studentEmail = text(req.user.email).toLowerCase()
    const bookmarks = getBookmarksCollection()
    const filter = {
      studentEmail,
      tuitionId: text(req.params.tuitionId),
    }
    const bookmark = await bookmarks.findOne(filter)
    if (!bookmark) {
      return res.status(404).json({ message: "Saved tuition not found." })
    }

    await bookmarks.deleteOne({ _id: bookmark._id })
    return res.status(200).json({
      message: "Removed from saved tuitions.",
      id: String(bookmark._id),
    })
  } catch (error) {
    return next(error)
  }
})

export default router
