import type { MealImage } from '@/lib/ai';

const MAX_EDGE = 1024;

/**
 * Downscales a photo to at most 1024 px on its long edge and re-encodes it as JPEG, so an
 * estimate costs a fraction of a full-resolution phone photo and stays under provider limits.
 */
export async function prepareMealPhoto(file: File): Promise<{ image: MealImage; previewUrl: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process photos.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { image: { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }, previewUrl: dataUrl };
}
