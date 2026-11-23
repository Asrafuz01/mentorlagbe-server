/** Returns trimmed text, or `null` when the value is the wrong type or too long. */
export function readBoundedText(value, maxLength) {
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  return trimmed.length <= maxLength ? trimmed : null
}

/** Returns a finite, in-range number, or `null` when the value is invalid. */
export function readBoundedNumber(
  value,
  { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}
) {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value !== "number" && typeof value !== "string") return null

  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) return null
  return number
}
