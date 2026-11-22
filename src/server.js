import cors from "cors"
import express from "express"

import { connectDB, disconnectDB, isDBConnected } from "./config/db.js"
import { env, getMissingEnvKeys } from "./config/env.js"

const app = express()

app.disable("x-powered-by")
app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json({ limit: "1mb" }))

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    db: isDBConnected() ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" })
})

app.use((error, _req, res, _next) => {
  console.error("[http] Request failed:", error)
  const status = Number.isInteger(error.status) ? error.status : 500
  res.status(status).json({
    message: status === 500 ? "Internal server error" : error.message,
  })
})

let httpServer = null
let shuttingDown = false

async function startServer() {
  const missing = getMissingEnvKeys()
  if (missing.length > 0) {
    console.warn(`[config] Missing or empty: ${missing.join(", ")}`)
  }

  try {
    await connectDB()
  } catch (error) {
    console.warn(`[db] Startup connection failed: ${error.message}`)
    console.warn("[db] HTTP server will start without database routes.")
  }

  httpServer = app.listen(env.port, () => {
    console.log(`[server] MentorLagbe API listening on http://localhost:${env.port}`)
    console.log(`[server] Health check: http://localhost:${env.port}/api/health`)
  })

  httpServer.on("error", (error) => {
    console.error("[server] Failed to start:", error.message)
    process.exit(1)
  })
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] ${signal} received — shutting down`)

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve))
  }
  await disconnectDB()
  console.log("[server] Shutdown complete")
  process.exit(exitCode)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection:", reason)
})
process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception:", error)
  void shutdown("uncaughtException", 1)
})

startServer().catch((error) => {
  console.error("[server] Fatal startup error:", error)
  process.exit(1)
})
