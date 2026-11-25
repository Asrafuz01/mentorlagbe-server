export const MAX_COMMENT_LENGTH = 1000

/** Accepts a 1–5 star rating from a number or numeric string, else null. */
export function normalizeRating(value) {
  if (typeof value !== "number" && typeof value !== "string") return null
  const rating = Number(value)
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null
}

/** Trims optional feedback; null means the value was invalid/too long. */
export function normalizeComment(value) {
  if (value === undefined || value === null || value === "") return ""
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length <= MAX_COMMENT_LENGTH ? trimmed : null
}

/** Average rounded to one decimal place, plus the number of valid reviews. */
export function ratingStats(reviews) {
  const values = (Array.isArray(reviews) ? reviews : [])
    .map((review) => Number(review?.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5)

  if (values.length === 0) return { averageRating: 0, reviewCount: 0 }

  const total = values.reduce((sum, rating) => sum + rating, 0)
  return {
    averageRating: Math.round((total / values.length) * 10) / 10,
    reviewCount: values.length,
  }
}
