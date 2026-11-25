import assert from "node:assert/strict"
import test from "node:test"

import {
  canSaveMore,
  FREE_BOOKMARK_LIMIT,
} from "../src/utils/bookmark-utils.js"
import {
  MAX_COMMENT_LENGTH,
  normalizeComment,
  normalizeRating,
  ratingStats,
} from "../src/utils/review-utils.js"

test("free students are capped while pro plans stay unlimited", () => {
  assert.equal(canSaveMore("free", 0), true)
  assert.equal(canSaveMore("free", FREE_BOOKMARK_LIMIT - 1), true)
  assert.equal(canSaveMore("free", FREE_BOOKMARK_LIMIT), false)
  assert.equal(canSaveMore("student-pro", 100), true)
  assert.equal(canSaveMore("tutor-pro", 100), true)
  assert.equal(canSaveMore("pro", 100), true)
  assert.equal(canSaveMore("free", "not-a-number"), false)
})

test("ratings accept only whole numbers from 1 to 5", () => {
  assert.equal(normalizeRating(1), 1)
  assert.equal(normalizeRating("5"), 5)
  assert.equal(normalizeRating(3.5), null)
  assert.equal(normalizeRating(0), null)
  assert.equal(normalizeRating(6), null)
  assert.equal(normalizeRating("abc"), null)
  assert.equal(normalizeRating(null), null)
})

test("feedback is trimmed and bounded", () => {
  assert.equal(normalizeComment(undefined), "")
  assert.equal(normalizeComment(null), "")
  assert.equal(normalizeComment("  Great tutor  "), "Great tutor")
  assert.equal(normalizeComment("x".repeat(MAX_COMMENT_LENGTH)).length, MAX_COMMENT_LENGTH)
  assert.equal(normalizeComment("x".repeat(MAX_COMMENT_LENGTH + 1)), null)
  assert.equal(normalizeComment(42), null)
})

test("rating stats ignore invalid ratings and round the average", () => {
  assert.deepEqual(ratingStats([]), { averageRating: 0, reviewCount: 0 })
  assert.deepEqual(ratingStats([{ rating: 5 }, { rating: 4 }, { rating: "bad" }]), {
    averageRating: 4.5,
    reviewCount: 2,
  })
  assert.deepEqual(ratingStats([{ rating: 5 }, { rating: 5 }, { rating: 4 }]), {
    averageRating: 4.7,
    reviewCount: 3,
  })
})
