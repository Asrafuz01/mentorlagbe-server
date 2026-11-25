import { isProPlan } from "./user.js"

/** Free students can keep a shortlist; Pro students save without a cap. */
export const FREE_BOOKMARK_LIMIT = 5

/**
 * Returns whether another tuition may be saved for the given plan/count.
 * Kept pure so the rule can be unit tested without a database.
 */
export function canSaveMore(plan, currentCount) {
  if (isProPlan(plan)) return true
  const count = Number(currentCount)
  return Number.isFinite(count) && count >= 0 && count < FREE_BOOKMARK_LIMIT
}
