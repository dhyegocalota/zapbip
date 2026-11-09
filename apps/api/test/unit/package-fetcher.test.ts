import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPackageFetcher } from '../../src/operations/package-fetcher';

const START_LINK_URL = 'https://mcp.zapbip.com/start';
const WHEEL_URL = 'https://mcp.zapbip.com/pkg/zapbip_platform-0.1.0-py3-none-any.whl';
const WHEEL_BYTES = new Uint8Array([80, 75, 3, 4, 255, 0, 128]);

function sha256Of(input: { bytes: Uint8Array }): string {
  return createHash('sha256').update(input.bytes).digest('hex');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('package fetcher', () => {
  it('returns the status and the sha256 of the bytes it was given', async () => {
    const fetchSpy = vi.fn(async () => new Response(WHEEL_BYTES, { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const answer = await createPackageFetcher()({ url: WHEEL_URL });
    expect(answer).toEqual({ status: 200, sha256: sha256Of({ bytes: WHEEL_BYTES }), location: null });
    expect(fetchSpy).toHaveBeenCalledWith(WHEEL_URL, { redirect: 'manual' });
  });

  it('hashes the body of a failure too, so a 404 never looks like the wheel', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
    const answer = await createPackageFetcher()({ url: WHEEL_URL });
    expect(answer.status).toBe(404);
    expect(answer.sha256).not.toBe(sha256Of({ bytes: WHEEL_BYTES }));
  });

  it('returns a redirect without following it, with its Location', async () => {
    const target = 'https://wa.me/5511999990001?text=hi';
    vi.stubGlobal('fetch', async () => new Response(null, { status: 302, headers: { Location: target } }));
    const answer = await createPackageFetcher()({ url: START_LINK_URL });
    expect(answer).toMatchObject({ status: 302, location: target });
  });

  it('lets a network failure reject', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('getaddrinfo ENOTFOUND mcp.zapbip.com');
    });
    await expect(createPackageFetcher()({ url: WHEEL_URL })).rejects.toThrow('ENOTFOUND');
  });
});
