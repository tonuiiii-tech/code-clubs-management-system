/**
 * The file's real type from its first bytes, never from its name or the request header (D2-3).
 * Returns null for anything that is not a JPG, PNG or PDF.
 */
const SIGNATURES = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
];

export function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const match = SIGNATURES.find(({ bytes }) => bytes.every((b, i) => buffer[i] === b));
  return match?.type ?? null;
}

/** File name for a download, e.g. consent-participation.pdf. */
export function fileExtension(type) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[type] ?? 'bin';
}

const FAMILIES = [
  { family: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { family: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { family: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  // ZIP, and the files built on it: Office, OpenDocument and Scratch (D5-2).
  { family: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

/** The kind of file from its first bytes: 'pdf', 'png', 'jpeg', 'zip' or null. */
export function detectFileFamily(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  return FAMILIES.find(({ bytes }) => bytes.every((b, i) => buffer[i] === b))?.family ?? null;
}
