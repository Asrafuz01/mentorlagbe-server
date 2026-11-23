import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import { verifySignedCookieValue } from "../src/utils/better-auth-session.js"

const SECRET = "test-secret-that-is-long-enough-for-hmac"

function signedValue(value, secret = SECRET) {
  const signature = createHmac("sha256", secret).update(value).digest("base64")
  return `${value}.${signature}`
}

test("accepts a correctly signed BetterAuth cookie value", () => {
  const token = "session-token-with-dots.like.betterauth"
  assert.equal(verifySignedCookieValue(signedValue(token), SECRET), token)
})

test("accepts a URL-encoded BetterAuth cookie value", () => {
  const token = "session-token"
  assert.equal(
    verifySignedCookieValue(encodeURIComponent(signedValue(token)), SECRET),
    token
  )
})

test("rejects tampered, unsigned, and wrong-secret values", () => {
  const token = "session-token"
  const tampered = signedValue(token).replace(/.$/, "A")

  assert.equal(verifySignedCookieValue(tampered, SECRET), null)
  assert.equal(verifySignedCookieValue(token, SECRET), null)
  assert.equal(
    verifySignedCookieValue(signedValue(token), "another-test-secret"),
    null
  )
  assert.equal(verifySignedCookieValue(signedValue(token), ""), null)
})
