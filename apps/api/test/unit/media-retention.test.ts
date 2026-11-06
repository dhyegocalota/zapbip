import { MEDIA_RETENTION_MS } from '@zapbip/core';
import { describe, expect, it } from 'vitest';
import { runMediaRetention } from '../../src/operations/media-retention';

const NOW = 1_800_000_000_000;
const PAGE_SIZE = 1_000;
const OLD_UPLOADED_AT = NOW - MEDIA_RETENTION_MS - 1;
const BOUNDARY_UPLOADED_AT = NOW - MEDIA_RETENTION_MS;
const RECENT_UPLOADED_AT = NOW - 1;

type StoredObject = { key: string; uploadedAt: number };

function createFakeBucket(input: { objects: StoredObject[] }) {
  const stored = new Map(input.objects.map((object) => [object.key, object.uploadedAt]));
  const listCursors: (string | undefined)[] = [];
  const bucket = {
    async list(options: R2ListOptions) {
      listCursors.push(options.cursor);
      const keys = [...stored.keys()];
      const start = options.cursor === undefined ? 0 : Number(options.cursor);
      const end = start + PAGE_SIZE;
      const objects = keys.slice(start, end).map((key) => ({ key, uploaded: new Date(stored.get(key) as number) }));
      return end < keys.length ? { objects, truncated: true, cursor: String(end) } : { objects, truncated: false };
    },
    async delete(keys: string | string[]) {
      [keys].flat().forEach((key) => stored.delete(key));
    },
  } as unknown as Pick<R2Bucket, 'list' | 'delete'>;
  return { bucket, listCursors, remainingKeys: () => [...stored.keys()] };
}

function objectsAt(input: { count: number; uploadedAt: (index: number) => number }): StoredObject[] {
  return Array.from({ length: input.count }, (_, index) => ({
    key: `accounts/acc_1/media/med_${index}`,
    uploadedAt: input.uploadedAt(index),
  }));
}

describe('media retention', () => {
  it('deletes an object past the retention and keeps one exactly at it', async () => {
    const fake = createFakeBucket({
      objects: [
        { key: 'accounts/acc_1/media/old', uploadedAt: OLD_UPLOADED_AT },
        { key: 'accounts/acc_1/media/boundary', uploadedAt: BOUNDARY_UPLOADED_AT },
      ],
    });
    await runMediaRetention({ bucket: fake.bucket, now: NOW });
    expect(fake.remainingKeys()).toEqual(['accounts/acc_1/media/boundary']);
  });

  it('deletes every old object across pages and requests the second page with the first cursor', async () => {
    const fake = createFakeBucket({ objects: objectsAt({ count: PAGE_SIZE + 1, uploadedAt: () => OLD_UPLOADED_AT }) });
    await runMediaRetention({ bucket: fake.bucket, now: NOW });
    expect(fake.remainingKeys()).toEqual([]);
    expect(fake.listCursors).toEqual([undefined, String(PAGE_SIZE)]);
  });

  it('deletes exactly the old objects of a mixed set', async () => {
    const fake = createFakeBucket({
      objects: objectsAt({ count: PAGE_SIZE + 1, uploadedAt: (index) => (index % 2 === 0 ? OLD_UPLOADED_AT : RECENT_UPLOADED_AT) }),
    });
    await runMediaRetention({ bucket: fake.bucket, now: NOW });
    const expectedKeys = objectsAt({ count: PAGE_SIZE + 1, uploadedAt: () => RECENT_UPLOADED_AT })
      .filter((_, index) => index % 2 === 1)
      .map((object) => object.key);
    expect(fake.remainingKeys()).toEqual(expectedKeys);
  });

  it('keeps running when a listed key is already gone', async () => {
    const fake = createFakeBucket({ objects: objectsAt({ count: 2, uploadedAt: () => OLD_UPLOADED_AT }) });
    const listed = await fake.bucket.list({});
    await fake.bucket.delete(listed.objects.map((object) => object.key));
    await expect(runMediaRetention({ bucket: fake.bucket, now: NOW })).resolves.toBeUndefined();
  });
});
