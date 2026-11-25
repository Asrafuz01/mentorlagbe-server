import assert from "node:assert/strict"
import test from "node:test"

import { toPublicUser } from "../src/utils/user.js"

test("public users expose a logical pro tier alias", () => {
  assert.equal(
    toPublicUser({ _id: "u1", email: "student@example.com", plan: "free" }).planTier,
    "free"
  )
  assert.equal(
    toPublicUser({ _id: "u2", email: "student@example.com", plan: "student-pro" })
      .planTier,
    "pro"
  )
  assert.equal(
    toPublicUser({ _id: "u3", email: "tutor@example.com", plan: "tutor-pro" }).planTier,
    "pro"
  )
  assert.equal(
    toPublicUser({ _id: "u4", email: "tutor@example.com", plan: "pro" }).planTier,
    "pro"
  )
})
