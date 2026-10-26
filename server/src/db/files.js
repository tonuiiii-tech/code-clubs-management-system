import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

/**
 * Uploaded files in MongoDB GridFS (D2-3, D2-7). Files are only ever sent through an
 * authorised endpoint; nothing here builds a public URL.
 */
export const BUCKETS = Object.freeze({
  consentFiles: 'consentFiles',
  sessionPhotos: 'sessionPhotos',
  eventPhotos: 'eventPhotos',
  eventConsentFiles: 'eventConsentFiles',
});

const bucket = (name) =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: name });

/** Saves a file and returns its id (a UUID string, like every other id, D1-21). */
export async function saveFile(bucketName, buffer, { contentType, metadata = {} }) {
  const id = randomUUID();
  await new Promise((resolve, reject) => {
    const upload = bucket(bucketName).openUploadStreamWithId(id, id, {
      metadata: { contentType, ...metadata },
    });
    upload.once('finish', resolve).once('error', reject);
    upload.end(buffer);
  });
  return id;
}

/** { buffer, contentType, length } or null when there is no such file. */
export async function readFile(bucketName, id) {
  const [file] = await bucket(bucketName).find({ _id: id }).limit(1).toArray();
  if (!file) return null;
  const chunks = [];
  for await (const chunk of bucket(bucketName).openDownloadStream(id)) chunks.push(chunk);
  return {
    buffer: Buffer.concat(chunks),
    contentType: file.metadata?.contentType,
    length: file.length,
  };
}

/** The id of a file uploaded by a syncing device with this opId, or null. */
export async function findFileByOpId(bucketName, opId) {
  const [file] = await bucket(bucketName).find({ 'metadata.opId': opId }).limit(1).toArray();
  return file?._id ?? null;
}

export async function deleteFile(bucketName, id) {
  try {
    await bucket(bucketName).delete(id);
  } catch (err) {
    // Already gone is fine.
    if (!/File not found/i.test(err?.message ?? '')) throw err;
  }
}
