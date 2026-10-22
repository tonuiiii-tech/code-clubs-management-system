import { conflict } from '../utils/httpError.js';

/**
 * Repositories return plain records with `id`, never Mongoose documents or `_id`,
 * so services and the API stay independent of the database (D1-16).
 */
export function toRecord(doc) {
  if (!doc) return null;
  const { _id, __v: _v, ...rest } = doc;
  return { id: _id, ...rest };
}

/** Turns a record with `id` into a document with `_id` (UUID string, D1-21). */
export function toDocument({ id, ...rest }) {
  return { _id: id, ...rest };
}

/** { data, page, pageSize, total } for list endpoints (D1-19). */
export async function paginate(model, filter, { page = 1, pageSize = 20 }, sort) {
  const [docs, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    model.countDocuments(filter),
  ]);
  return { data: docs.map(toRecord), page, pageSize, total };
}

/** Case-insensitive "contains" search on several fields, with regex characters escaped. */
export function textSearch(q, fields) {
  if (!q) return {};
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) };
}

/** Inserts a record; a unique-index clash (two people saving at once) becomes a 409. */
export async function insertUnique(model, record, conflictMessage) {
  try {
    await model.create(toDocument(record));
  } catch (err) {
    if (err?.code === 11000) throw conflict(conflictMessage);
    throw err;
  }
  return record;
}

/** Updates a record by id and returns it; a unique-index clash becomes a 409. */
export async function updateUnique(model, id, changes, conflictMessage) {
  try {
    return toRecord(await model.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean());
  } catch (err) {
    if (err?.code === 11000) throw conflict(conflictMessage);
    throw err;
  }
}
