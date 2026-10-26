import { Resource } from '../../db/models.js';
import { paginate, textSearch, toDocument, toRecord } from '../../db/records.js';

/** The resource library (plan section 5). Plain records only (D1-16). */

export async function listResources({ q, type, track, ageBand, language, status }, page) {
  const query = {
    $and: [
      textSearch(q, ['title', 'description']),
      type ? { type } : {},
      track ? { tracks: track } : {},
      ageBand ? { ageBands: ageBand } : {},
      language ? { language } : {},
      status ? { status } : {},
    ],
  };
  return paginate(Resource, query, page, { title: 1, _id: 1 });
}

export async function findResource(id, { publishedOnly }) {
  return toRecord(
    await Resource.findOne({ _id: id, ...(publishedOnly && { status: 'published' }) }).lean(),
  );
}

export const insertResource = (resource) => Resource.create(toDocument(resource));

export async function updateResource(id, changes) {
  return toRecord(
    await Resource.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' }).lean(),
  );
}

export const deleteResource = (id) => Resource.deleteOne({ _id: id });
