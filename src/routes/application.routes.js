import { Router } from "express"

import {
  getApplicationsCollection,
  getTuitionsCollection,
  isDBConnected,
} from "../config/db.js"
import { verifyStudent, verifyToken, verifyTutor } from "../middlewares/auth.middleware.js"
import { findById, hasValidId } from "../utils/ids.js"

const router = Router()
const VALID_STATUSES = new Set(["accepted", "rejected"])

const databaseUnavailable = (res) =>
  res.status(503).json({ message: "Database is unavailable. Try again shortly." })

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function isTutorOf(tuition, email) {
  if (!tuition) return false
  return Boolean(email && text(tuition.tutorEmail).toLowerCase() === email.toLowerCase())
}

function isOpenForApplications(tuition) {
  return Boolean(
    tuition &&
      text(tuition.approvalStatus).toLowerCase() === "approved" &&
      tuition.isActive === true
  )
}

router.post("/", verifyToken, verifyStudent, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const tuitionId = text(req.body?.tuitionId)
    if (!tuitionId) {
      return res.status(400).json({ message: "tuitionId is required." })
    }

    const tuitions = getTuitionsCollection()
    const tuition = await findById(tuitions, tuitionId)
    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found." })
    }
    if (!isOpenForApplications(tuition)) {
      return res.status(409).json({
        message: "This tuition is not currently accepting applications.",
      })
    }

    const applications = getApplicationsCollection()
    const storedTuitionId = String(tuition._id)
    const studentEmail = text(req.user.email).toLowerCase()
    const duplicate = await applications.findOne({
      tuitionId: storedTuitionId,
      studentEmail,
    })
    if (duplicate) {
      return res.status(409).json({
        message: "You have already applied to this tuition.",
        application: duplicate,
      })
    }

    const now = new Date()
    const application = {
      tuitionId: storedTuitionId,
      studentId: req.user.userId || "",
      studentName: text(req.body.studentName) || text(req.user.name),
      studentEmail,
      studentPhone: text(req.body.studentPhone),
      preferredSchedule: text(req.body.preferredSchedule),
      studentNote: text(req.body.studentNote) || text(req.body.note),
      message: text(req.body.message),
      status: "pending",
      tutorEmail: text(tuition.tutorEmail),
      tutorName: text(tuition.tutorName),
      tutorId: text(tuition.tutorId),
      tuitionTitle: text(tuition.title),
      subject: text(tuition.subject),
      monthlyFee: Number(tuition.monthlyFee) || 0,
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
    }

    let result
    try {
      result = await applications.insertOne(application)
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          message: "You have already applied to this tuition.",
        })
      }
      throw error
    }
    return res.status(201).json({ ...application, _id: result.insertedId })
  } catch (error) {
    return next(error)
  }
})

router.get("/", verifyToken, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)

    const email = text(req.user.email).toLowerCase()
    let filter = {}
    if (req.user.role === "student") {
      filter = { studentEmail: email }
    } else if (req.user.role === "tutor") {
      filter = { tutorEmail: email }
    }

    const applications = await getApplicationsCollection()
      .find(filter)
      .sort({ appliedAt: -1, createdAt: -1, _id: -1 })
      .toArray()

    return res.status(200).json({
      data: applications,
      applications,
      total: applications.length,
    })
  } catch (error) {
    return next(error)
  }
})

router.delete("/:id", verifyToken, verifyStudent, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application id." })
    }

    const applications = getApplicationsCollection()
    const application = await findById(applications, req.params.id)
    if (!application) {
      return res.status(404).json({ message: "Application not found." })
    }
    if (text(application.studentEmail).toLowerCase() !== text(req.user.email).toLowerCase()) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own applications." })
    }
    if (application.status !== "pending") {
      return res.status(400).json({
        message: "Only pending applications can be cancelled.",
      })
    }

    await applications.deleteOne({ _id: application._id })
    return res.status(200).json({
      message: "Application cancelled.",
      id: String(application._id),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch("/:id/status", verifyToken, verifyTutor, async (req, res, next) => {
  try {
    if (!isDBConnected()) return databaseUnavailable(res)
    if (!hasValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application id." })
    }

    const status = text(req.body?.status).toLowerCase()
    if (!VALID_STATUSES.has(status)) {
      return res
        .status(400)
        .json({ message: "Status must be 'accepted' or 'rejected'." })
    }

    const applications = getApplicationsCollection()
    const application = await findById(applications, req.params.id)
    if (!application) {
      return res.status(404).json({ message: "Application not found." })
    }
    const email = text(req.user.email).toLowerCase()
    const tuition = await findById(getTuitionsCollection(), text(application.tuitionId))
    if (!isTutorOf(tuition, email) && text(application.tutorEmail).toLowerCase() !== email) {
      return res
        .status(403)
        .json({ message: "You can only respond to applications for your tuitions." })
    }

    if (application.status !== "pending") {
      return res.status(400).json({
        message: "Only pending applications can be accepted or rejected.",
      })
    }

    await applications.updateOne(
      { _id: application._id },
      { $set: { status, updatedAt: new Date() } }
    )
    const updated = await applications.findOne({ _id: application._id })
    return res.status(200).json(updated)
  } catch (error) {
    return next(error)
  }
})

export default router
