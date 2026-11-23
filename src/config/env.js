import "dotenv/config"

function readString(name, fallback = "") {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

/** Centralised, validated-by-usage environment values for the whole server. */
export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: readString("NODE_ENV", "development"),
  isProduction: readString("NODE_ENV", "development").toLowerCase() === "production",
  clientUrl: readString("CLIENT_URL", "http://localhost:3000"),
  mongodbUri: readString("MONGODB_URI"),
  dbName: readString("DB_NAME", "mentorlagbedb"),
  jwtSecret: readString("JWT_SECRET"),
  betterAuthSecret: readString("BETTER_AUTH_SECRET"),
  betterAuthCookiePrefix: readString("BETTER_AUTH_COOKIE_PREFIX", "better-auth"),
  allowDevJwtWithoutSession:
    readString("ALLOW_DEV_JWT_WITHOUT_SESSION").toLowerCase() === "true",
  stripeSecretKey: readString("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: readString("STRIPE_WEBHOOK_SECRET"),
  stripeStudentProPriceId: readString("STRIPE_STUDENT_PRO_PRICE_ID"),
  stripeTutorProPriceId: readString("STRIPE_TUTOR_PRO_PRICE_ID"),
}

const REQUIRED_ENV_KEYS = [
  "MONGODB_URI",
  "JWT_SECRET",
  "BETTER_AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_STUDENT_PRO_PRICE_ID",
  "STRIPE_TUTOR_PRO_PRICE_ID",
]

/** Reports missing secrets at startup without preventing the health route from running. */
export function getMissingEnvKeys() {
  return REQUIRED_ENV_KEYS.filter((key) => !readString(key))
}
