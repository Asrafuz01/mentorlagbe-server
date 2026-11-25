/**
 * Payment responses expose the logical design field names while the database
 * keeps the canonical Stripe-backed fields used by routes, indexes, and seed
 * data. This mapper is intentionally additive and read-only.
 */

export function isPaidPaymentStatus(status) {
  const value = typeof status === "string" ? status.trim().toLowerCase() : ""
  return value === "completed" || value === "paid" || value === "succeeded"
}

export function toCanonicalPaymentStatus(status) {
  const value = typeof status === "string" ? status.trim().toLowerCase() : ""
  if (!value) return "pending"
  if (isPaidPaymentStatus(value) || value === "complete") return "completed"
  return value
}

export function serializePayment(payment) {
  const source = payment && typeof payment === "object" ? payment : {}
  const canonicalStatus = toCanonicalPaymentStatus(
    source.status || source.paymentStatus
  )
  const isPaid = isPaidPaymentStatus(source.status) || isPaidPaymentStatus(canonicalStatus)
  const createdAt = source.createdAt || null
  const updatedAt = source.updatedAt || null
  const transactionId =
    source.transactionId ||
    source.stripePaymentIntentId ||
    source.stripeSessionId ||
    (source._id ? String(source._id) : "")

  return {
    ...source,
    _id: source._id ? String(source._id) : undefined,
    userId: source.userId || "",
    plan: source.plan || "free",
    planName: source.planName || source.plan || "free",
    amount: Number(source.amount) || 0,
    currency:
      typeof source.currency === "string" && source.currency.trim()
        ? source.currency.trim().toUpperCase()
        : "USD",
    status: canonicalStatus,
    paymentStatus: isPaid ? "paid" : canonicalStatus,
    transactionId,
    stripeSessionId: source.stripeSessionId || "",
    stripePaymentIntentId: source.stripePaymentIntentId || "",
    paidAt: source.paidAt || (isPaid ? updatedAt || createdAt : null),
    createdAt,
    updatedAt,
  }
}
