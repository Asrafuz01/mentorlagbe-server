import { MongoClient } from "mongodb"

import { env } from "./env.js"

const COLLECTIONS = {
  users: "users",
  tuitions: "tuitions",
  applications: "applications",
  payments: "payments",
  bookmarks: "bookmarks",
  reviews: "reviews",
  // BetterAuth's default singular model names.
  authUsers: "user",
  authSessions: "session",
}

let client = null
let database = null
let pendingConnection = null

export function isDBConnected() {
  return Boolean(client && database)
}

/** Returns the active database or throws a clear setup error. */
export function getDB() {
  if (!database) {
    throw new Error("Database is not connected. Call connectDB() first.")
  }
  return database
}

export function getUsersCollection() {
  return getDB().collection(COLLECTIONS.users)
}

export function getTuitionsCollection() {
  return getDB().collection(COLLECTIONS.tuitions)
}

export function getApplicationsCollection() {
  return getDB().collection(COLLECTIONS.applications)
}

export function getPaymentsCollection() {
  return getDB().collection(COLLECTIONS.payments)
}

export function getBookmarksCollection() {
  return getDB().collection(COLLECTIONS.bookmarks)
}

export function getReviewsCollection() {
  return getDB().collection(COLLECTIONS.reviews)
}

/** BetterAuth's user and session stores, used only for session verification. */
export function getAuthUsersCollection() {
  return getDB().collection(COLLECTIONS.authUsers)
}

export function getAuthSessionsCollection() {
  return getDB().collection(COLLECTIONS.authSessions)
}

/** Creates query indexes without letting a legacy/shaped collection block startup. */
async function safeCreateIndex(collection, spec, options, label) {
  try {
    await collection.createIndex(spec, options)
  } catch (error) {
    console.warn(`[db] Could not create ${label} index: ${error.message}`)
  }
}

/** Indexes the filters used by the public catalog, dashboards, and payment flows. */
async function ensureIndexes() {
  await Promise.all([
    safeCreateIndex(getUsersCollection(), { email: 1 }, {}, "users.email"),
    safeCreateIndex(getUsersCollection(), { role: 1 }, {}, "users.role"),
    safeCreateIndex(getAuthUsersCollection(), { email: 1 }, {}, "auth.user_email"),
    safeCreateIndex(getAuthSessionsCollection(), { token: 1 }, {}, "auth.session_token"),
    safeCreateIndex(
      getTuitionsCollection(),
      { approvalStatus: 1, isActive: 1, createdAt: -1, _id: -1 },
      {},
      "tuitions.public_catalog"
    ),
    safeCreateIndex(
      getTuitionsCollection(),
      { tutorEmail: 1, createdAt: -1, _id: -1 },
      {},
      "tuitions.tutor_email"
    ),
    safeCreateIndex(
      getTuitionsCollection(),
      { tutorId: 1, createdAt: -1, _id: -1 },
      {},
      "tuitions.tutor_id"
    ),
    safeCreateIndex(getTuitionsCollection(), { seedKey: 1 }, {}, "tuitions.seed_key"),
    safeCreateIndex(
      getApplicationsCollection(),
      { studentEmail: 1, appliedAt: -1, createdAt: -1, _id: -1 },
      {},
      "applications.student"
    ),
    safeCreateIndex(
      getApplicationsCollection(),
      { tutorEmail: 1, appliedAt: -1, createdAt: -1, _id: -1 },
      {},
      "applications.tutor"
    ),
    safeCreateIndex(
      getApplicationsCollection(),
      { tuitionId: 1, studentEmail: 1 },
      {
        name: "uniq_application_per_student",
        unique: true,
        partialFilterExpression: { studentEmail: { $type: "string" } },
      },
      "applications.unique_student"
    ),
    safeCreateIndex(
      getApplicationsCollection(),
      { seedKey: 1 },
      {},
      "applications.seed_key"
    ),
    safeCreateIndex(
      getPaymentsCollection(),
      { stripeSessionId: 1 },
      {},
      "payments.stripe_session"
    ),
    safeCreateIndex(
      getPaymentsCollection(),
      { status: 1, createdAt: -1, _id: -1 },
      {},
      "payments.status_recent"
    ),
    safeCreateIndex(getPaymentsCollection(), { seedKey: 1 }, {}, "payments.seed_key"),
    safeCreateIndex(
      getBookmarksCollection(),
      { studentEmail: 1, createdAt: -1, _id: -1 },
      {},
      "bookmarks.student_recent"
    ),
    safeCreateIndex(
      getBookmarksCollection(),
      { studentEmail: 1, tuitionId: 1 },
      {
        name: "uniq_bookmark_per_student",
        unique: true,
        partialFilterExpression: { studentEmail: { $type: "string" } },
      },
      "bookmarks.unique_student_tuition"
    ),
    safeCreateIndex(
      getBookmarksCollection(),
      { seedKey: 1 },
      {},
      "bookmarks.seed_key"
    ),
    safeCreateIndex(
      getReviewsCollection(),
      { tuitionId: 1, createdAt: -1, _id: -1 },
      {},
      "reviews.tuition_recent"
    ),
    safeCreateIndex(
      getReviewsCollection(),
      { tuitionId: 1, studentEmail: 1 },
      {
        name: "uniq_review_per_student_tuition",
        unique: true,
        partialFilterExpression: { studentEmail: { $type: "string" } },
      },
      "reviews.unique_student_tuition"
    ),
    safeCreateIndex(getReviewsCollection(), { seedKey: 1 }, {}, "reviews.seed_key"),
  ])
}

/**
 * Connects once per process and reuses the same client.
 * A failed attempt clears the cached promise so a later retry can succeed.
 */
export function connectDB() {
  if (pendingConnection) return pendingConnection

  if (!env.mongodbUri) {
    return Promise.reject(
      new Error("MONGODB_URI is empty. Add it to .env to enable database routes.")
    )
  }

  const mongoClient = new MongoClient(env.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  })

  pendingConnection = (async () => {
    try {
      await mongoClient.connect()
      await mongoClient.db("admin").command({ ping: 1 })
      client = mongoClient
      database = mongoClient.db(env.dbName)
      console.log(`[db] Connected to MongoDB database "${env.dbName}"`)
      void ensureIndexes()
      return database
    } catch (error) {
      await mongoClient.close().catch(() => {})
      pendingConnection = null
      throw error
    }
  })()

  return pendingConnection
}

export async function disconnectDB() {
  if (!client) return

  await client.close()
  client = null
  database = null
  pendingConnection = null
  console.log("[db] MongoDB connection closed")
}
