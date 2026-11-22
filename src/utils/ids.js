import { ObjectId } from "mongodb"

/** Returns an ObjectId for 24-hex strings, or null for string-ID collections. */
export function toObjectId(value) {
  if (typeof value !== "string" || !value.trim() || !ObjectId.isValid(value)) {
    return null
  }
  return new ObjectId(value)
}

export function hasValidId(value) {
  return typeof value === "string" && Boolean(value.trim())
}

/** Looks up a record by ObjectId first, then by a literal string _id. */
export function findById(collection, id) {
  const objectId = toObjectId(id)
  if (objectId) {
    return collection
      .findOne({ _id: objectId })
      .then((record) => record || collection.findOne({ _id: String(id) }))
  }
  return collection.findOne({ _id: String(id) })
}
