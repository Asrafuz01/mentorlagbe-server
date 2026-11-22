import { MongoClient } from "mongodb"

import { env } from "./env.js"

const COLLECTIONS = {
  users: "users",
  tuitions: "tuitions",
  applications: "applications",
  payments: "payments",
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
