import { MEDIA_RETENTION_MS } from '@zapbip/core';
import { listMediaObjects } from '../adapters/r2/r2-media-listing';

const DELETE_BATCH_SIZE = 1_000;

export async function runMediaRetention(input: { bucket: Pick<R2Bucket, 'list' | 'delete'>; now: number }): Promise<void> {
  const retentionCutoff = input.now - MEDIA_RETENTION_MS;
  const objects = await listMediaObjects({ bucket: input.bucket });
  const expiredKeys = objects.filter((object) => object.uploaded.getTime() < retentionCutoff).map((object) => object.key);
  const batches = Array.from({ length: Math.ceil(expiredKeys.length / DELETE_BATCH_SIZE) }, (_, index) =>
    expiredKeys.slice(index * DELETE_BATCH_SIZE, (index + 1) * DELETE_BATCH_SIZE),
  );
  await batches.reduce(async (previous, keys) => {
    await previous;
    await input.bucket.delete(keys);
  }, Promise.resolve());
}
