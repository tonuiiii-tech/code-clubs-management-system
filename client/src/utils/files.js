import { SESSION_MAX_PHOTOS } from '@code-clubs/shared/enums';

/** About 300 KB per session photo, so 3 photos stay small on Atlas and slow connections (D2-7). */
export const PHOTO_TARGET_BYTES = 300 * 1024;
export { SESSION_MAX_PHOTOS };

/**
 * Shrinks a photo on the device before upload: at most 1600 px on the long side, JPEG, lowering
 * the quality until it is about 300 KB. Returns the original file if the browser cannot do it.
 */
export async function shrinkPhoto(file, { maxSide = 1600, targetBytes = PHOTO_TARGET_BYTES } = {}) {
  if (typeof createImageBitmap !== 'function' || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = null;
    for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= targetBytes) break;
    }
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/** Saves a downloaded file without keeping it anywhere else (R2-2). */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const extensionFor = (type) =>
  ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' })[type] ?? 'bin';
