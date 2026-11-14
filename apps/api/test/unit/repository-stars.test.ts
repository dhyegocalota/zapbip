import { afterEach, describe, expect, it, vi } from 'vitest';
import { repositoryStarsOf, type RepositoryStarsCache } from '../../src/site/repository-stars';
import { captureLogLines } from '../support/capture-log-lines';

const REPOSITORY_API_URL = 'https://api.github.com/repos/dhyegocalota/zapbip';
const STAR_COUNT = 1234;
const AN_HOUR_IN_SECONDS = 3600;
const FIVE_MINUTES_IN_SECONDS = 300;

type MemoryCache = RepositoryStarsCache & { entries: Map<string, Response> };

function memoryCache(): MemoryCache {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: (async (request: RequestInfo) => entries.get(String(request))?.clone()) as Cache['match'],
    put: (async (request: RequestInfo, response: Response) => void entries.set(String(request), response)) as Cache['put'],
  };
}

function respondingWith(input: { body: unknown; status?: number }): typeof fetch {
  const { body, status = 200 } = input;
  return vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

function failingFetch(): typeof fetch {
  return vi.fn(async () => {
    throw new TypeError('network down');
  }) as unknown as typeof fetch;
}

function maxAgeOf(input: { cache: MemoryCache }): string | null {
  return input.cache.entries.get(REPOSITORY_API_URL)!.headers.get('Cache-Control');
}

afterEach(() => vi.restoreAllMocks());

describe('repositoryStarsOf', () => {
  it('reads the star count from the GitHub API with a User-Agent and keeps it for an hour', async () => {
    const cache = memoryCache();
    const fetchImplementation = respondingWith({ body: { full_name: 'dhyegocalota/zapbip', stargazers_count: STAR_COUNT } });
    expect(await repositoryStarsOf({ fetchImplementation, cache })).toBe(STAR_COUNT);
    const [url, init] = vi.mocked(fetchImplementation).mock.calls[0]!;
    const headers = new Headers((init as RequestInit).headers);
    expect(url).toBe(REPOSITORY_API_URL);
    expect(headers.get('User-Agent')).toMatch(/^zapbip/);
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(headers.get('Authorization')).toBeNull();
    expect(maxAgeOf({ cache })).toBe(`max-age=${AN_HOUR_IN_SECONDS}`);
  });

  it('answers from the cache without asking GitHub again', async () => {
    const cache = memoryCache();
    await repositoryStarsOf({ fetchImplementation: respondingWith({ body: { stargazers_count: STAR_COUNT } }), cache });
    const secondFetch = respondingWith({ body: { stargazers_count: 1 } });
    expect(await repositoryStarsOf({ fetchImplementation: secondFetch, cache })).toBe(STAR_COUNT);
    expect(secondFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['the network fails', failingFetch(), 'fetch_failed'],
    ['GitHub answers 403', respondingWith({ body: { message: 'API rate limit exceeded' }, status: 403 }), 'bad_status'],
    ['the body is not JSON', respondingWith({ body: 'not json' }), 'malformed_body'],
    ['the count is missing', respondingWith({ body: { full_name: 'dhyegocalota/zapbip' } }), 'malformed_body'],
    ['the count is negative', respondingWith({ body: { stargazers_count: -1 } }), 'malformed_body'],
    ['the count is not a whole number', respondingWith({ body: { stargazers_count: '1234' } }), 'malformed_body'],
  ])('answers no count, never zero, when %s, and logs why', async (_case, fetchImplementation, errorCode) => {
    const lines = captureLogLines();
    expect(await repositoryStarsOf({ fetchImplementation, cache: memoryCache() })).toBeNull();
    expect(lines.join('\n')).toContain('site.repository_stars_failed');
    expect(lines.join('\n')).toContain(errorCode);
  });

  it('keeps a failure for five minutes so a page view does not wait on GitHub again', async () => {
    captureLogLines();
    const cache = memoryCache();
    await repositoryStarsOf({ fetchImplementation: failingFetch(), cache });
    expect(maxAgeOf({ cache })).toBe(`max-age=${FIVE_MINUTES_IN_SECONDS}`);
    const secondFetch = respondingWith({ body: { stargazers_count: STAR_COUNT } });
    expect(await repositoryStarsOf({ fetchImplementation: secondFetch, cache })).toBeNull();
    expect(secondFetch).not.toHaveBeenCalled();
  });
});
