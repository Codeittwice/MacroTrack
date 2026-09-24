import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive, newRecord, softDelete } from '@/db/repo';
import type { DateKey, ProgressPhoto } from '@/db/types';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function validateBlob(blob: Blob): void {
  if (!blob.size || blob.size > MAX_PHOTO_BYTES) throw new Error('photo must be between 1 byte and 10 MB');
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('photo must be an image');
}

export async function getPhotos(): Promise<ProgressPhoto[]> {
  return (await db.photos.orderBy('date').reverse().toArray()).filter(alive);
}

export function usePhotos(): ProgressPhoto[] | undefined {
  return useLiveQuery(getPhotos, []);
}

export async function savePhoto(input: { date: DateKey; blob: Blob; pose?: ProgressPhoto['pose'] }): Promise<ProgressPhoto> {
  validateBlob(input.blob);
  const photo: ProgressPhoto = newRecord(input);
  await db.photos.put(photo);
  return photo;
}

export async function deletePhoto(id: string): Promise<void> {
  await softDelete(db.photos, id);
}
