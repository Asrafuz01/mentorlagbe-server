import { Router } from "express"

import {
  getApplicationsCollection,
  getReviewsCollection,
  getTuitionsCollection,
  isDBConnected,
} from "../config/db.js"
import { verifyStudent, verifyToken } from "../middlewares/auth.middleware.js"
import { findById, hasValidId } from "../utils/ids.js"
import {
  MAX_COMMENT_LENGTH,
  normalizeComment,
  normalizeRating,
  ratingStats,
} from "../utils/review-utils.js"
import { readBoundedText } from "../utils/validation.js"

const router = Router()
const MAX_TUITION_ID_LENGTH = 255

const databaseUnavailable = (res) =>
  res.status(503).json({ message: "Database is unavailable. Try again shortly." })

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function dateString(value) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? text(value) : date.toISOString()
}

function isReviewableTuition(tuition) {
  return Boolean(
    tuition &&
      text(tuition.approvalStatus).toLowerCase() === "approved" &&
      tuition.isActive !== false
  )
}

function serializeReview(review) {
  return {
    ...review,
    _id: String(review._id),
    rating: Number(review.rating) || 0,
    studentName: text(review.studentName),
    studentEmail: text(review.studentEmail),
    comment: text(review.comment),
    createdAt: dateString(review.createdAt),
    updatedAt: dateString(review.updatedAt),
  }
}

/** Keeps the tuition's cached rating fields in sync with its reviews. */
async function syncTuitionRating(tuition) {
  if (!tuition) return null
  const tuitionId = String(tuition._id)
  const reviews = await getReviewsCollection().find({ tuitionId }).toArray()
  const stats = ratingStats(reviews)
  await getTuitionsCollection().updateOne(
    { _id: tuition._id },
    {
      $set: {
        averageRating: stats.averageRating,
        reviewCount: stats.reviewCount,
      },
    }
  )
  return stats
}

/** Public review list + aggregate for a tuition detail page. */
router.get("/", async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const tuitionId = text(req.query.tuitionId)
    if (!tuitionId) {
      return res.status(400).json({ message: "tuitionId is required." })
    }

    const reviews = await getReviewsCollection()
      .find({ tuitionId })
      .sort({ createdAt: -1, _id: -1 })
      .toArray()
    const items = reviews.map(serializeReview)

    return res.status(200).json({
      data: items,
      reviews: items,
      total: items.length,
      ...ratingStats(reviews),
    })
  } catch (error) {
    return next(error)
  }
})

/** Eligibility and the signed-in student's existing review (if any). */
router.get("/mine", verifyToken, verifyStudent, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const tuitionId = text(req.query.tuitionId)
    if (!tuitionId) {
      return res.status(400).json({ message: "tuitionId is required." })
    }

    const studentEmail = text(req.user.email).toLowerCase()
    const accepted = await getApplicationsCollection().findOne({
      tuitionId,
      studentEmail,
      status: "accepted",
    })
    const review = await getReviewsCollection().findOne({
      tuitionId,
      studentEmail,
    })

    return res.status(200).json({
      eligible: Boolean(accepted),
      review: review ? serializeReview(review) : null,
    })
  } catch (error) {
    return next(error)
  }
})

/** Creates or updates the student's 1–5 star review for an accepted tuition. */
router.post("/", verifyToken, verifyStudent, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const body = req.body && typeof req.body === "object" ? req.body : {}
    const tuitionId = readBoundedText(body.tuitionId, MAX_TUITION_ID_LENGTH)
    if (tuitionId === null) {
      return res.status(400).json({ message: "tuitionId is invalid." })
    }
    if (!tuitionId) {
      return res.status(400).json({ message: "tuitionId is required." })
    }

    const rating = normalizeRating(body.rating)
    if (rating === null) {
      return res
        .status(400)
        .json({ message: "Rating must be a whole number from 1 to 5." })
    }
    const comment = normalizeComment(body.comment)
    if (comment === null) {
      return res.status(400).json({
        message: `Feedback must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
      })
    }

    const tuition = await findById(getTuitionsCollection(), tuitionId)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    if (!isReviewableTuition(tuition)) {
      return res.status(409).json({
        message: "Reviews are only available for active, approved tuitions.",
      })
    }

    const storedTuitionId = String(tuition._id)
    const studentEmail = text(req.user.email).toLowerCase()
    const accepted = await getApplicationsCollection().findOne({
      tuitionId: storedTuitionId,
      studentEmail,
      status: "accepted",
    })
    if (!accepted) {
      return res.status(403).json({
        message:
          "Only students with an accepted application can review this tuition.",
      })
    }

    const now = new Date()
    const filter = { tuitionId: storedTuitionId, studentEmail }
    const result = await getReviewsCollection().updateOne(
      filter,
      {
        $set: {
          rating,
          comment,
          studentName: text(req.user.name) || text(body.studentName),
          studentId: req.user.userId || "",
          updatedAt: now,
        },
        $setOnInsert: { ...filter, createdAt: now },
      },
      { upsert: true }
    )

    const saved = await getReviewsCollection().findOne(filter)
    await syncTuitionRating(tuition)
    return res
      .status(result.upsertedCount === 1 ? 201 : 200)
      .json(serializeReview(saved))
  } catch (error) {
    return next(error)
  }
})

/** Lets a student remove their own review. */
router.delete("/:id", verifyToken, verifyStudent, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid review id." })
    }

    const reviews = getReviewsCollection()
    const review = await findById(reviews, req.params.id)
    if (!review) {
      return res.status(404).json({ message: "Review not found." })
    }
    const studentEmail = text(req.user.email).toLowerCase()
    if (text(review.studentEmail).toLowerCase() !== studentEmail) {
      return res.status(403).json({ message: "You can only remove your own review." })
    }

    await reviews.deleteOne({ _id: review._id })
    const tuition = await findById(
      getTuitionsCollection(),
      text(review.tuitionId)
    )
    await syncTuitionRating(tuition)
    return res.status(200).json({ message: "Review removed." })
  } catch (error) {
    return next(error)
  }
})

export default router
