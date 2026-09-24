import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { deletePhoto, getPhotos, savePhoto } from './actions';

beforeEach(async () => db.photos.clear());

describe('progress photos', () => {
  it('stores an image blob with its date and pose', async () => {
    const photo = await savePhoto({ date: '2026-09-24', blob: new Blob(['image'], { type: 'image/jpeg' }), pose: 'front' });
    expect(await getPhotos()).toMatchObject([{ id: photo.id, date: '2026-09-24', pose: 'front' }]);
  });

  it('rejects invalid blobs and soft-deletes photos', async () => {
    await expect(savePhoto({ date: '2026-09-24', blob: new Blob(['text'], { type: 'text/plain' }) })).rejects.toThrow('image');
    const photo = await savePhoto({ date: '2026-09-24', blob: new Blob(['image'], { type: 'image/png' }) });
    await deletePhoto(photo.id);
    expect(await getPhotos()).toEqual([]);
  });
});
