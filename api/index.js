import app from "../src/server.js"
import { connectDB } from "../src/config/db.js"

// Await the cached connection at cold start so the first serverless request
// cannot reach a DB-backed route before Mongo is ready. The shared middleware
// in server.js additionally guards warm invocations/reconnects.
await connectDB().catch((error) => {
  console.error("[db] Vercel entry connection failed:", error.message)
})

export default app
