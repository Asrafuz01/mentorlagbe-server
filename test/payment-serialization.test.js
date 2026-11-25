import assert from "node:assert/strict"
import test from "node:test"

import {
  isPaidPaymentStatus,
  serializePayment,
  toCanonicalPaymentStatus,
} from "../src/utils/payment.js"

test("completed payments expose logical design aliases", () => {
  const payment = serializePayment({
    _id: "payment-1",
    plan: "student-pro",
    amount: 10,
    currency: "usd",
    status: "completed",
    stripePaymentIntentId: "pi_123",
    stripeSessionId: "cs_123",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  })

  assert.equal(payment.status, "completed")
  assert.equal(payment.paymentStatus, "paid")
  assert.equal(payment.planName, "student-pro")
  assert.equal(payment.transactionId, "pi_123")
  assert.equal(payment.paidAt, "2026-01-02T00:00:00.000Z")
  assert.equal(payment.currency, "USD")
})

test("pending payments keep the canonical status and have no paid date", () => {
  const payment = serializePayment({
    _id: "payment-2",
    plan: "tutor-pro",
    status: "pending",
    stripeSessionId: "cs_456",
    createdAt: "2026-02-01T00:00:00.000Z",
  })

  assert.equal(payment.status, "pending")
  assert.equal(payment.paymentStatus, "pending")
  assert.equal(payment.transactionId, "cs_456")
  assert.equal(payment.paidAt, null)
})

test("design-shaped paid records are accepted without changing storage", () => {
  const payment = serializePayment({
    _id: "payment-3",
    planName: "pro",
    status: "paid",
    transactionId: "txn_789",
    paidAt: "2026-03-01T00:00:00.000Z",
  })

  assert.equal(payment.status, "completed")
  assert.equal(payment.paymentStatus, "paid")
  assert.equal(payment.plan, "free")
  assert.equal(payment.planName, "pro")
  assert.equal(payment.transactionId, "txn_789")
  assert.equal(payment.paidAt, "2026-03-01T00:00:00.000Z")
})

test("status helpers normalize known paid spellings", () => {
  assert.equal(isPaidPaymentStatus("completed"), true)
  assert.equal(isPaidPaymentStatus(" PAID "), true)
  assert.equal(isPaidPaymentStatus("pending"), false)
  assert.equal(toCanonicalPaymentStatus("paid"), "completed")
  assert.equal(toCanonicalPaymentStatus("refunded"), "refunded")
  assert.equal(toCanonicalPaymentStatus(null), "pending")
})
