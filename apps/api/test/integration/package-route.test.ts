import { HERMES_WHEEL_PATH_PREFIX, hermesWheelFilename, HttpStatus, ZAPBIP_HERMES_PLUGIN_VERSION } from '@zapbip/types';
import { env, SELF } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { packageRoutes } from '../../src/routes/package';
import { ORIGIN } from './route-fixtures';

const WHEEL_FILENAME = hermesWheelFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION });
const WHEEL_URL = `${ORIGIN}${HERMES_WHEEL_PATH_PREFIX}${WHEEL_FILENAME}`;
const WHEEL_TEXT = 'wheel-bytes';
const WHEEL_BYTES = new TextEncoder().encode(WHEEL_TEXT);
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const NO_STORE = 'no-store';
const NOT_FOUND_BODY = { error: 'not_found' };
const MALFORMED_PATHS = [
  '/pkg/evil.whl',
  '/pkg/zapbip_platform-1.0-py3-none-any.whl',
  '/pkg/..%2Fsecret',
  '/pkg/%2e%2e%2fsecret',
  '/pkg/ZAPBIP_PLATFORM-0.1.0-py3-none-any.whl',
  `/pkg/${WHEEL_FILENAME}.`,
  `/pkg/${WHEEL_FILENAME}/extra`,
  '/pkg/',
];
const WRITE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

type CountingBucket = { bucket: R2Bucket; reads: () => number };

function countingBucket(): CountingBucket {
  let reads = 0;
  const bucket = {
    get: async () => {
      reads += 1;
      return null;
    },
  } as unknown as R2Bucket;
  return { bucket, reads: () => reads };
}

async function seedWheel(): Promise<void> {
  await env.PACKAGES.put(WHEEL_FILENAME, WHEEL_BYTES);
}

describe('package route', () => {
  test('serves the stored wheel with immutable cache headers', async () => {
    await seedWheel();
    const response = await SELF.fetch(WHEEL_URL);
    expect(response.status).toBe(HttpStatus.Ok);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(WHEEL_BYTES);
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('etag')).not.toBeNull();
  });

  test('answers 404 with no-store when the wheel is not uploaded yet', async () => {
    await env.PACKAGES.delete(WHEEL_FILENAME);
    const response = await SELF.fetch(WHEEL_URL);
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(await response.json()).toEqual(NOT_FOUND_BODY);
    expect(response.headers.get('cache-control')).toBe(NO_STORE);
  });

  test.each(MALFORMED_PATHS)('answers 404 for %s without reading the bucket', async (path) => {
    const { bucket, reads } = countingBucket();
    const response = await packageRoutes.request(path, undefined, { ...env, PACKAGES: bucket });
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(reads()).toBe(0);
  });

  test.each(WRITE_METHODS)('answers 404 to %s and leaves the bucket unchanged', async (method) => {
    await seedWheel();
    const response = await SELF.fetch(WHEEL_URL, { method, body: new TextEncoder().encode('overwrite') });
    expect(response.status).toBe(HttpStatus.NotFound);
    const stored = await env.PACKAGES.get(WHEEL_FILENAME);
    expect(await stored?.text()).toBe(WHEEL_TEXT);
  });

  test('does not reach the media bucket', async () => {
    await env.PACKAGES.delete(WHEEL_FILENAME);
    await env.MEDIA.put(WHEEL_FILENAME, WHEEL_BYTES);
    const response = await SELF.fetch(WHEEL_URL);
    expect(response.status).toBe(HttpStatus.NotFound);
  });

  test('answers 503 without an immutable cache header when the bucket fails', async () => {
    const failingBucket = {
      get: async () => {
        throw new Error('r2 unavailable');
      },
    } as unknown as R2Bucket;
    const response = await packageRoutes.request(`${HERMES_WHEEL_PATH_PREFIX}${WHEEL_FILENAME}`, undefined, {
      ...env,
      PACKAGES: failingBucket,
    });
    expect(response.status).toBe(HttpStatus.ServiceUnavailable);
    expect(response.headers.get('cache-control')).not.toBe(IMMUTABLE_CACHE_CONTROL);
  });
});
