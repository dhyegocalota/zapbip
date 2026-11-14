import { SECOND_MS } from '@zapbip/types';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import {
  REPOSITORY_API_ACCEPT,
  REPOSITORY_API_URL,
  REPOSITORY_STARS_CACHE_MS,
  REPOSITORY_STARS_RETRY_MS,
  REPOSITORY_STARS_TIMEOUT_MS,
  REPOSITORY_USER_AGENT,
} from './site-constants';

export type RepositoryStarsCache = Pick<Cache, 'match' | 'put'>;

export type StarCountSource = () => Promise<number | null>;

type CachedStars = { stars: number | null };
type RepositoryBody = { stargazers_count?: unknown };

const FETCH_FAILED_CODE = 'fetch_failed';
const BAD_STATUS_CODE = 'bad_status';
const MALFORMED_BODY_CODE = 'malformed_body';

async function remember(input: { cache: RepositoryStarsCache; stars: number | null; lifetimeMs: number }): Promise<number | null> {
  const { cache, stars, lifetimeMs } = input;
  const cached: CachedStars = { stars };
  await cache.put(REPOSITORY_API_URL, Response.json(cached, { headers: { 'Cache-Control': `max-age=${lifetimeMs / SECOND_MS}` } }));
  return stars;
}

function failure(input: { cache: RepositoryStarsCache; errorCode: string }): Promise<number | null> {
  logEvent({ event: LogEvent.SiteRepositoryStarsFailed, errorCode: input.errorCode });
  return remember({ cache: input.cache, stars: null, lifetimeMs: REPOSITORY_STARS_RETRY_MS });
}

export async function repositoryStarsOf(input: { fetchImplementation: typeof fetch; cache: RepositoryStarsCache }): Promise<number | null> {
  const { fetchImplementation, cache } = input;
  const cached = await cache.match(REPOSITORY_API_URL);
  if (cached !== undefined) return ((await cached.json()) as CachedStars).stars;
  const response = await fetchImplementation(REPOSITORY_API_URL, {
    headers: { Accept: REPOSITORY_API_ACCEPT, 'User-Agent': REPOSITORY_USER_AGENT },
    signal: AbortSignal.timeout(REPOSITORY_STARS_TIMEOUT_MS),
  }).catch(() => null);
  if (response === null) return failure({ cache, errorCode: FETCH_FAILED_CODE });
  if (!response.ok) return failure({ cache, errorCode: BAD_STATUS_CODE });
  const body = (await response.json().catch(() => null)) as RepositoryBody | null;
  const stars = body?.stargazers_count;
  const isStarCount = typeof stars === 'number' && Number.isInteger(stars) && stars >= 0;
  if (!isStarCount) return failure({ cache, errorCode: MALFORMED_BODY_CODE });
  return remember({ cache, stars, lifetimeMs: REPOSITORY_STARS_CACHE_MS });
}
