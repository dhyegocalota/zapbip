import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPackageFetcher } from '../../src/operations/package-fetcher';

const RELEASE_URL = 'https://pypi.org/pypi/zapbip-platform/0.1.0/json';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('package fetcher', () => {
  it('returns the status and the parsed JSON body of the url it was given', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ info: { maintainer: 'owner' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const answer = await createPackageFetcher()({ url: RELEASE_URL });
    expect(answer).toEqual({ status: 200, body: { info: { maintainer: 'owner' } } });
    expect(fetchSpy).toHaveBeenCalledWith(RELEASE_URL);
  });

  it('returns a null body when the answer is not JSON', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>Not Found</html>', { status: 404 }));
    expect(await createPackageFetcher()({ url: RELEASE_URL })).toEqual({ status: 404, body: null });
  });

  it('lets a network failure reject', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('getaddrinfo ENOTFOUND pypi.org');
    });
    await expect(createPackageFetcher()({ url: RELEASE_URL })).rejects.toThrow('ENOTFOUND');
  });
});
