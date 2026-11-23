import { Router } from "express"
import Stripe from "stripe"

import {
  getPaymentsCollection,
  getUsersCollection,
  isDBConnected,
} from "../config/db.js"
import { env } from "../config/env.js"
import { verifyToken } from "../middlewares/auth.middleware.js"
import { paymentVerifyRateLimit } from "../middlewares/rate-limit.js"
import { normalizeRole } from "../utils/user.js"

const router = Router()
const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null
const MAX_SESSION_ID_LENGTH = 255

const PLANS = {
  "student-pro": {
    amount: 1000,
    currency: "usd",
    name: "MentorLagbe Pro Student",
    description: "Unlock unlimited student applications and Pro features.",
    priceKey: "stripeStudentProPriceId",
  },
  "tutor-pro": {
    amount: 1500,
    currency: "usd",
    name: "MentorLagbe Pro Tutor",
    description: "Publish unlimited tuitions and reach more students.",
    priceKey: "stripeTutorProPriceId",
  },
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeEmail(value) {
  return text(value).toLowerCase()
}

function normalizePlan(value, role) {
  const plan = text(value).toLowerCase().replace(/[\s_]+/g, "-")
  if (PLANS[plan]) return plan
  if (plan === "pro" || plan === "premium") {
    return normalizeRole(role) === "tutor" ? "tutor-pro" : "student-pro"
  }
  return null
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function databaseUnavailable(res) {
  return res
    .status(503)
    .json({ message: "Database is unavailable. Try again shortly." })
}

function stripeUnavailable(res) {
  return res.status(503).json({
    message:
      "Stripe is not configured on the server. Add STRIPE_SECRET_KEY to .env to enable checkout.",
  })
}

/** Payment/session details are only readable by the customer who created them. */
function isPaymentOwner(payment, user) {
  const paymentEmail = normalizeEmail(payment.userEmail)
  const userEmail = normalizeEmail(user.email)
  const paymentUserId = text(payment.userId)
  const userId = text(user.userId)

  return Boolean(
    (userEmail && paymentEmail === userEmail) ||
      (userId && paymentUserId === userId)
  )
}

function paymentNotFound(res) {
  return res.status(404).json({ message: "Payment session not found for this account." })
}

/** Derives the same identity from Stripe metadata, query fallbacks, or a local record. */
function identityFromSession(session = {}, fallback = {}) {
  const metadata =
    session.metadata && typeof session.metadata === "object" ? session.metadata : {}
  const rawIntent = session.payment_intent
  const paymentIntentId =
    typeof rawIntent === "string"
      ? rawIntent
      : rawIntent && typeof rawIntent === "object"
        ? text(rawIntent.id)
        : ""

  const role = normalizeRole(
    metadata.userRole || fallback.userRole ||
      (normalizePlan(metadata.plan || fallback.plan, fallback.userRole) === "tutor-pro"
        ? "tutor"
        : "student")
  )
  const plan =
    normalizePlan(metadata.plan || fallback.plan, role) ||
    (role === "tutor" ? "tutor-pro" : "student-pro")

  return {
    plan,
    userEmail: normalizeEmail(
      metadata.userEmail || fallback.userEmail || session.customer_email ||
        session.customer_details?.email
    ),
    userName: text(metadata.userName || fallback.userName),
    userRole: role,
    userId: text(
      metadata.userId || fallback.userId || session.client_reference_id
    ),
    stripeSessionId: text(session.id || fallback.stripeSessionId),
    stripePaymentIntentId: paymentIntentId || text(fallback.stripePaymentIntentId),
  }
}

function amountFromSession(session, fallbackAmount) {
  const amount = Number(session?.amount_total)
  return Number.isFinite(amount) && amount > 0 ? amount / 100 : fallbackAmount
}

/** Uses configured Stripe prices when set, otherwise safe dynamic price_data. */
async function buildCheckoutItems(plan, requestedMode) {
  const config = PLANS[plan]
  const priceId = env[config.priceKey]

  if (priceId) {
    const price = await stripe.prices.retrieve(priceId).catch(() => {
      throw httpError(502, "Could not validate the configured Stripe price.")
    })
    return {
      mode: price.recurring ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      unitAmount: price.unit_amount ?? config.amount,
      currency: text(price.currency, config.currency),
    }
  }

  const mode = requestedMode === "subscription" ? "subscription" : "payment"
  return {
    mode,
    line_items: [
      {
        price_data: {
          currency: config.currency,
          product_data: {
            name: config.name,
            description: config.description,
          },
          unit_amount: config.amount,
          ...(mode === "subscription" ? { recurring: { interval: "month" } } : {}),
        },
        quantity: 1,
      },
    ],
    unitAmount: config.amount,
    currency: config.currency,
  }
}

async function resolveUserId(email, providedUserId) {
  if (providedUserId || !email || !isDBConnected()) return text(providedUserId)
  const user = await getUsersCollection().findOne({ email })
  return user ? String(user._id) : ""
}

async function recordPendingPayment(session, identity, pricing) {
  if (!isDBConnected()) return null

  const payments = getPaymentsCollection()
  const now = new Date()
  const amount = amountFromSession(session, pricing.unitAmount / 100)

  await payments.updateOne(
    { stripeSessionId: identity.stripeSessionId },
    {
      $setOnInsert: {
        userId: identity.userId,
        plan: identity.plan,
        amount,
        currency: pricing.currency.toUpperCase(),
        status: "pending",
        userName: identity.userName,
        userEmail: identity.userEmail,
        userRole: identity.userRole,
        stripeSessionId: identity.stripeSessionId,
        stripePaymentIntentId: identity.stripePaymentIntentId,
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true }
  )
  return payments.findOne({ stripeSessionId: identity.stripeSessionId })
}

/** Idempotently records a completed payment and activates the buyer's Pro plan. */
async function fulfillPaidSession(session, fallback = {}) {
  if (!isDBConnected()) return null

  const identity = identityFromSession(session, fallback)
  if (!identity.stripeSessionId) return null

  const config = PLANS[identity.plan]
  const payments = getPaymentsCollection()
  const users = getUsersCollection()
  const now = new Date()
  const amount = amountFromSession(
    session,
    Number(fallback.amount) || config.amount / 100
  )

  await payments.updateOne(
    { stripeSessionId: identity.stripeSessionId },
    {
      $set: {
        userId: identity.userId,
        plan: identity.plan,
        amount,
        currency: text(session.currency || fallback.currency, config.currency).toUpperCase(),
        status: "completed",
        userName: identity.userName,
        userEmail: identity.userEmail,
        userRole: identity.userRole,
        stripePaymentIntentId: identity.stripePaymentIntentId,
        updatedAt: now,
      },
      $setOnInsert: {
        stripeSessionId: identity.stripeSessionId,
        createdAt: now,
      },
    },
    { upsert: true }
  )

  if (identity.userEmail) {
    await users.updateOne(
      { email: identity.userEmail },
      {
        $set: {
          plan: identity.plan,
          proPlan: identity.plan,
          updatedAt: now.toISOString(),
        },
        $setOnInsert: {
          name: identity.userName || identity.userEmail.split("@")[0],
          role:
            normalizeRole(identity.userRole) === "admin"
              ? "student"
              : normalizeRole(identity.userRole) || "student",
          createdAt: now.toISOString(),
        },
      },
      { upsert: true }
    )
  }

  return payments.findOne({ stripeSessionId: identity.stripeSessionId })
}

router.post("/create-checkout-session", verifyToken, async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {}
    const plan = normalizePlan(body.plan, req.user.role)
    if (!plan) {
      return res.status(400).json({
        message: "plan must be 'student-pro' or 'tutor-pro'.",
      })
    }
    const requestedMode = text(body.mode)
    if (requestedMode && requestedMode !== "payment" && requestedMode !== "subscription") {
      return res.status(400).json({ message: "mode must be 'payment' or 'subscription'." })
    }
    if (!stripe) return stripeUnavailable(res)

    const userEmail = normalizeEmail(req.user.email)
    if (!userEmail) {
      return res.status(400).json({ message: "A verified account email is required." })
    }

    const role = plan === "tutor-pro" ? "tutor" : "student"
    const pricing = await buildCheckoutItems(plan, requestedMode)
    const identity = {
      plan,
      userEmail,
      userName: text(req.user.name),
      userRole: role,
      userId: await resolveUserId(userEmail, req.user.userId),
    }

    const session = await stripe.checkout.sessions.create({
      mode: pricing.mode,
      line_items: pricing.line_items,
      success_url: `${env.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.clientUrl}/payment/cancel`,
      customer_email: userEmail,
      client_reference_id: identity.userId || undefined,
      metadata: {
        plan: identity.plan,
        userEmail: identity.userEmail,
        userName: identity.userName,
        userRole: identity.userRole,
        userId: identity.userId,
      },
    })

    if (!session?.url || !session?.id) {
      throw httpError(502, "Stripe did not return a checkout URL.")
    }

    await recordPendingPayment(session, identity, pricing)
    return res.status(200).json({
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    return next(error)
  }
})

router.get("/verify", verifyToken, paymentVerifyRateLimit, async (req, res, next) => {
  try {
    const sessionId = text(req.query.session_id)
    if (!sessionId || sessionId.length > MAX_SESSION_ID_LENGTH) {
      return res.status(400).json({ message: "A valid session_id is required." })
    }

    if (!isDBConnected()) return databaseUnavailable(res)
    const payments = getPaymentsCollection()

    if (!stripe) {
      const local = await payments.findOne({ stripeSessionId: sessionId })
      if (!local || !isPaymentOwner(local, req.user)) return paymentNotFound(res)
      if (text(local.status) !== "completed") {
        return res.status(409).json({
          message: "Payment has not been completed yet.",
          status: local.status,
        })
      }

      const payment = await fulfillPaidSession(
        { id: sessionId },
        {
          plan: local.plan,
          userEmail: local.userEmail,
          userName: local.userName,
          userRole: local.userRole,
          userId: local.userId,
          stripeSessionId: local.stripeSessionId,
          stripePaymentIntentId: local.stripePaymentIntentId,
          amount: local.amount,
          currency: local.currency,
        }
      )
      return res.status(200).json({ verified: true, payment })
    }

    const session = await stripe.checkout.sessions
      .retrieve(sessionId)
      .catch(() => {
        throw httpError(404, "Stripe checkout session not found.")
      })

    const sessionIdentity = identityFromSession(session)
    if (!isPaymentOwner(sessionIdentity, req.user)) {
      const local = await payments.findOne({ stripeSessionId: sessionId })
      if (!local || !isPaymentOwner(local, req.user)) return paymentNotFound(res)
    }

    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return res.status(409).json({
        message: "Payment has not been completed yet.",
        status: session.payment_status,
      })
    }

    const payment = await fulfillPaidSession(session)
    return res.status(200).json({ verified: true, payment })
  } catch (error) {
    return next(error)
  }
})

router.post("/webhook", async (req, res, next) => {
  try {
    if (!stripe || !env.stripeWebhookSecret) {
      return res.status(503).json({
        message:
          "Stripe webhooks are not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.",
      })
    }

    const signature = req.headers["stripe-signature"]
    if (typeof signature !== "string" || !signature.trim()) {
      return res.status(400).json({ message: "Missing Stripe signature header." })
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))
    let event
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature.trim(),
        env.stripeWebhookSecret
      )
    } catch {
      return res.status(400).json({ message: "Invalid Stripe webhook signature." })
    }

    if (event.type !== "checkout.session.completed") {
      return res.status(200).json({ received: true, processed: false })
    }

    if (!isDBConnected()) return databaseUnavailable(res)

    let session = event.data?.object
    if (typeof session === "string" && stripe) {
      session = await stripe.checkout.sessions.retrieve(session)
    }

    const paymentStatus = text(session?.payment_status)
    if (
      paymentStatus &&
      paymentStatus !== "paid" &&
      paymentStatus !== "no_payment_required"
    ) {
      return res.status(200).json({ received: true, processed: false })
    }

    const payment = await fulfillPaidSession(session || {})
    return res.status(200).json({ received: true, processed: Boolean(payment) })
  } catch (error) {
    return next(error)
  }
})

export default router
