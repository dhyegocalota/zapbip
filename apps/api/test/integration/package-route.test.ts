import {
  HERMES_WHEEL_PATH_PREFIX,
  hermesRequirementsFilename,
  hermesWheelFilename,
  HttpStatus,
  ZAPBIP_HERMES_PLUGIN_VERSION,
} from '@zapbip/types';
import { env, SELF } from 'cloudflare:test';
import { describe, expect, test, vi } from 'vitest';
import { LogEvent } from '../../src/contract/log';
import { packageRoutes } from '../../src/routes/package';
import { ORIGIN } from './route-fixtures';

const WHEEL_FILENAME = hermesWheelFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION });
const REQUIREMENTS_FILENAME = hermesRequirementsFilename({ version: ZAPBIP_HERMES_PLUGIN_VERSION });
const REQUIREMENTS_URL = `${ORIGIN}${HERMES_WHEEL_PATH_PREFIX}${REQUIREMENTS_FILENAME}`;
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
  `/pkg/zapbip_platform-0.1.0-requirements.txt.bak`,
  `/pkg/zapbip_platform-0.1.0-extra.txt`,
  `/pkg/zapbip_platform-0.1.0-requirements.whl`,
  '/pkg/..%2fsecret',
  `/pkg/${WHEEL_FILENAME}%0A`,
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

  test('serves the stored requirements file as text with immutable cache headers', async () => {
    await env.PACKAGES.put(REQUIREMENTS_FILENAME, WHEEL_TEXT);
    const response = await SELF.fetch(REQUIREMENTS_URL);
    expect(response.status).toBe(HttpStatus.Ok);
    expect(await response.text()).toBe(WHEEL_TEXT);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
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
    expect(response.headers.get('cache-control')).toBe(NO_STORE);
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

  test('answers 503 without an immutable cache header when the bucket fails, logging only the event name', async () => {
    const logSpy = vi.spyOn(console, 'log');
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
    expect(response.headers.get('cache-control')).toBe(NO_STORE);
    expect(logSpy.mock.calls).toEqual([[JSON.stringify({ event: LogEvent.PackageUnavailable })]]);
    logSpy.mockRestore();
  });

  test.each([
    'zapbip_platform-9.9.9-py3-none-any.whl',
    'zapbip_platform-9.9.9-requirements.txt',
    `zapbip_platform-${ZAPBIP_HERMES_PLUGIN_VERSION}-py3-none-any.tar.gz`,
    `zapbip_platform-${ZAPBIP_HERMES_PLUGIN_VERSION}-py3-none-macosx.whl`,
  ])('answers 404 with no-store for the near miss %s even when the object exists', async (filename) => {
    await env.PACKAGES.put(filename, WHEEL_TEXT);
    const response = await SELF.fetch(`${ORIGIN}${HERMES_WHEEL_PATH_PREFIX}${filename}`);
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(response.headers.get('cache-control')).toBe(NO_STORE);
  });

  test('lets an encoded dot segment fall through to the global 404 without an immutable header', async () => {
    const response = await SELF.fetch(`${ORIGIN}/pkg/%2e%2e/secret`);
    expect(response.status).toBe(HttpStatus.NotFound);
    expect(response.headers.get('cache-control')).not.toBe(IMMUTABLE_CACHE_CONTROL);
  });

  test('answers HEAD like GET without a body', async () => {
    await seedWheel();
    const response = await SELF.fetch(WHEEL_URL, { method: 'HEAD' });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(await response.text()).toBe('');
  });
});
