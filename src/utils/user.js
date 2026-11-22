import { ObjectId } from "mongodb"

const ROLES = new Set(["student", "tutor", "admin"])
const PLANS = new Set(["free", "pro", "student-pro", "tutor-pro"])
const PRO_PLANS = new Set(["pro", "student-pro", "tutor-pro"])

export function normalizeRole(value) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : ""
  return ROLES.has(role) ? role : "student"
}

export function normalizePlan(value) {
  const plan = typeof value === "string" ? value.trim().toLowerCase() : ""
  return PLANS.has(plan) ? plan : "free"
}

export function isProPlan(value) {
  const plan = typeof value === "string" ? value.trim().toLowerCase() : ""
  return PRO_PLANS.has(plan)
}

/** Keeps the user shape sent to the Next.js client free of internal fields. */
export function toPublicUser(user) {
  return {
    id: String(user._id),
    _id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    role: normalizeRole(user.role),
    plan: normalizePlan(user.plan),
    image: user.image || null,
    phone: user.phone || "",
    bio: user.bio || "",
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  }
}

function asObjectId(value) {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    return new ObjectId(value)
  } catch {
    return null
  }
}

/** Matches both MongoDB ObjectIds and string IDs used by BetterAuth records. */
export function findUserForRequest(users, req) {
  const userId = req.user?.userId
  const email = req.user?.email
  const clauses = []

  if (userId) {
    const objectId = asObjectId(userId)
    if (objectId) clauses.push({ _id: objectId })
    clauses.push({ _id: userId }, { id: userId })
  }
  if (email) clauses.push({ email: String(email).trim().toLowerCase() })

  if (clauses.length === 0) return Promise.resolve(null)
  return users.findOne({ $or: clauses })
}
