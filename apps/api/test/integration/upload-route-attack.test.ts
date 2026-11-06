import { env, SELF } from 'cloudflare:test';
import { LinkPurpose } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { freshExpiry, inboxOf, ORIGIN, queryOf, seedAccount, signedQuery } from './route-fixtures';

const DECLARED_BYTES = 12;
const PDF_TYPE = 'application/pdf';
const STATUS_CREATED = 201;
const STATUS_BAD_REQUEST = 400;
const STATUS_CONFLICT = 409;
const STATUS_LENGTH_REQUIRED = 411;
const STATUS_PAYLOAD_TOO_LARGE = 413;
const CONCURRENT_LETTERS = 'abcdefgh'.split('');
const MALFORMED_CONTENT_LENGTHS = [
  '',
  ' ',
  '+12',
  '12 12',
  '12,12',
  '1_2',
  '１２',
  '12.',
  '.12',
  '1e1',
  '0b1100',
  '١٢',
  '-0',
  '99999999999999999999999',
  '00000000000000000000000000012',
];
const ACCEPTED_STATUSES = [STATUS_BAD_REQUEST, STATUS_LENGTH_REQUIRED, STATUS_PAYLOAD_TOO_LARGE, STATUS_CREATED];

type Fixture = { accountId: string; uploadId: string; target: string; objectKey: string };

async function newFixture(): Promise<Fixture> {
  const account = await seedAccount({ agent: 'alpha' });
  const outcome = await inboxOf({ accountId: account.accountId }).createUpload({
    connection: account.connection,
    filename: 'f.bin',
    mimeType: PDF_TYPE,
    sizeBytes: DECLARED_BYTES,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  const query = await signedQuery({
    key: env.UPLOAD_LINK_SIGNING_KEY,
    accountId: account.accountId,
    mediaId: outcome.value.uploadId,
    purpose: LinkPurpose.Upload,
    expiresAt: freshExpiry(),
  });
  return {
    accountId: account.accountId,
    uploadId: outcome.value.uploadId,
    target: `${ORIGIN}/u/${account.accountId}/${outcome.value.uploadId}?${queryOf(query)}`,
    objectKey: `accounts/${account.accountId}/media/${outcome.value.uploadId}`,
  };
}

function putBytes(input: { target: string; letter: string; contentLength: string }): Promise<Response> {
  return SELF.fetch(input.target, {
    method: 'PUT',
    headers: { 'Content-Type': PDF_TYPE, 'Content-Length': input.contentLength },
    body: new TextEncoder().encode(input.letter.repeat(DECLARED_BYTES)),
  });
}

describe('upload route attacks', () => {
  test('WI-130 pin: concurrent PUTs give one 201, the rest 409, and the stored bytes are the winner', async () => {
    const fixture = await newFixture();
    const responses = await Promise.all(
      CONCURRENT_LETTERS.map((letter) => putBytes({ target: fixture.target, letter, contentLength: String(DECLARED_BYTES) })),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      STATUS_CREATED,
      ...CONCURRENT_LETTERS.slice(1).map(() => STATUS_CONFLICT),
    ]);
    const winner = CONCURRENT_LETTERS[responses.findIndex((response) => response.status === STATUS_CREATED)];
    expect(await (await env.MEDIA.get(fixture.objectKey))?.text()).toBe(winner?.repeat(DECLARED_BYTES));
  });

  test('WI-131 pin: a PUT after the winner answers 409 and leaves the object untouched', async () => {
    const fixture = await newFixture();
    const first = await putBytes({ target: fixture.target, letter: 'a', contentLength: String(DECLARED_BYTES) });
    expect(first.status).toBe(STATUS_CREATED);
    const before = await env.MEDIA.head(fixture.objectKey);
    const second = await putBytes({ target: fixture.target, letter: 'b', contentLength: String(DECLARED_BYTES) });
    expect(second.status).toBe(STATUS_CONFLICT);
    expect((await env.MEDIA.head(fixture.objectKey))?.etag).toBe(before?.etag);
  });

  test.each(MALFORMED_CONTENT_LENGTHS)(
    'WI-132 pin: Content-Length %j never stores an object unless it is the declared size',
    async (contentLength) => {
      const fixture = await newFixture();
      const status = await putBytes({ target: fixture.target, letter: 'z', contentLength })
        .then((response) => response.status)
        .catch(() => null);
      const isRefused = status === null || status !== STATUS_CREATED;
      expect(status === null || ACCEPTED_STATUSES.includes(status)).toBe(true);
      if (isRefused) expect(await env.MEDIA.head(fixture.objectKey)).toBeNull();
    },
  );

  test('WI-132 pin: a zero-size PUT against the declared size answers 400 and stores nothing', async () => {
    const fixture = await newFixture();
    const response = await SELF.fetch(fixture.target, { method: 'PUT', headers: { 'Content-Type': PDF_TYPE, 'Content-Length': '0' } });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
    expect(await env.MEDIA.head(fixture.objectKey)).toBeNull();
  });
});
