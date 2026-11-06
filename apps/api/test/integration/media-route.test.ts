import { env, SELF } from 'cloudflare:test';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createR2MediaStore } from '../../src/adapters/r2/r2-media-store';
import { LinkPurpose } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { freshExpiry, ORIGIN, queryOf, signedQuery } from './route-fixtures';

const MEDIA_BYTES = new TextEncoder().encode('media-bytes');
const MEDIA_TYPE = 'image/png';
const STATUS_OK = 200;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;

type StoredFixture = { accountId: string; mediaId: string };

async function storeMedia({ mimeType = MEDIA_TYPE }: { mimeType?: string } = {}): Promise<StoredFixture> {
  const fixture = { accountId: `acc_${crypto.randomUUID()}`, mediaId: `med_${crypto.randomUUID()}` };
  const mediaStore = createR2MediaStore({
    bucket: env.MEDIA,
    mediaLinkSigningKey: env.MEDIA_LINK_SIGNING_KEY,
    uploadLinkSigningKey: env.UPLOAD_LINK_SIGNING_KEY,
    clock: createPlatformClock(),
  });
  await mediaStore.put({
    ...fixture,
    body: new Blob([MEDIA_BYTES]).stream(),
    sizeBytes: MEDIA_BYTES.byteLength,
    mimeType,
  });
  return fixture;
}

async function getMedia(input: { path: StoredFixture; signed: StoredFixture; key: string; expiresAt: number }): Promise<Response> {
  const query = await signedQuery({
    key: input.key,
    accountId: input.signed.accountId,
    mediaId: input.signed.mediaId,
    purpose: LinkPurpose.Read,
    expiresAt: input.expiresAt,
  });
  return SELF.fetch(`${ORIGIN}/m/${input.path.accountId}/${input.path.mediaId}?${queryOf(query)}`);
}

const PDF_TYPE = 'application/pdf';

describe('media route content type', () => {
  test('serves the normalized media type', async () => {
    const fixture = await storeMedia({ mimeType: 'IMAGE/PNG; charset=binary' });
    const response = await getMedia({ path: fixture, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt: freshExpiry() });
    expect(response.headers.get('content-type')).toBe(MEDIA_TYPE);
  });
});

describe('media route', () => {
  test.each([
    { mimeType: 'image/png', disposition: null },
    { mimeType: 'video/mp4', disposition: null },
    { mimeType: 'audio/ogg', disposition: null },
    { mimeType: PDF_TYPE, disposition: 'attachment' },
    { mimeType: 'text/html', disposition: 'attachment' },
    { mimeType: 'image/svg+xml', disposition: 'attachment' },
    { mimeType: 'IMAGE/SVG+XML; charset=utf-8', disposition: 'attachment' },
  ])('a $mimeType response is hardened and its disposition is $disposition', async ({ mimeType, disposition }) => {
    const fixture = await storeMedia({ mimeType });
    const response = await getMedia({ path: fixture, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt: freshExpiry() });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe('sandbox');
    expect(response.headers.get('content-disposition')).toBe(disposition);
    await response.arrayBuffer();
  });

  test('WI-85 a valid link answers 200 with the stored bytes and type', async () => {
    const fixture = await storeMedia();
    const response = await getMedia({ path: fixture, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt: freshExpiry() });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('content-type')).toBe(MEDIA_TYPE);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(MEDIA_BYTES);
  });

  test('WI-86 a forged signature answers 403', async () => {
    const fixture = await storeMedia();
    const query = await signedQuery({
      key: env.MEDIA_LINK_SIGNING_KEY,
      accountId: fixture.accountId,
      mediaId: fixture.mediaId,
      purpose: LinkPurpose.Read,
      expiresAt: freshExpiry(),
    });
    const flipped = query.signature.startsWith('0') ? `1${query.signature.slice(1)}` : `0${query.signature.slice(1)}`;
    const response = await SELF.fetch(`${ORIGIN}/m/${fixture.accountId}/${fixture.mediaId}?${queryOf({ ...query, signature: flipped })}`);
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test('WI-87 an expired link answers 403', async () => {
    const fixture = await storeMedia();
    const response = await getMedia({ path: fixture, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt: Date.now() - 1 });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test('WI-88 a link signed for another media id answers 403', async () => {
    const fixture = await storeMedia();
    const other = await storeMedia();
    const response = await getMedia({
      path: { accountId: fixture.accountId, mediaId: other.mediaId },
      signed: fixture,
      key: env.MEDIA_LINK_SIGNING_KEY,
      expiresAt: freshExpiry(),
    });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test('WI-89 a valid signature without an object answers 404', async () => {
    const missing = { accountId: `acc_${crypto.randomUUID()}`, mediaId: `med_${crypto.randomUUID()}` };
    const response = await getMedia({ path: missing, signed: missing, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt: freshExpiry() });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('WI-90 a link signed with the upload key answers 403', async () => {
    const fixture = await storeMedia();
    const response = await getMedia({ path: fixture, signed: fixture, key: env.UPLOAD_LINK_SIGNING_KEY, expiresAt: freshExpiry() });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test('WI-116 a swapped account id in the path answers 403 while the original path answers 200', async () => {
    const fixture = await storeMedia();
    const swapped = { accountId: `acc_${crypto.randomUUID()}`, mediaId: fixture.mediaId };
    const expiresAt = freshExpiry();
    const forged = await getMedia({ path: swapped, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt });
    const original = await getMedia({ path: fixture, signed: fixture, key: env.MEDIA_LINK_SIGNING_KEY, expiresAt });
    expect(forged.status).toBe(STATUS_FORBIDDEN);
    expect(original.status).toBe(STATUS_OK);
  });

  test.each([
    { label: 'a leading zero', exp: (expiresAt: number) => `0${expiresAt}` },
    { label: 'a plus sign', exp: (expiresAt: number) => `+${expiresAt}` },
    { label: 'surrounding spaces', exp: (expiresAt: number) => `%20${expiresAt}%20` },
  ])('a non-canonical expiry with $label answers 403', async ({ exp }) => {
    const fixture = await storeMedia();
    const query = await signedQuery({
      key: env.MEDIA_LINK_SIGNING_KEY,
      accountId: fixture.accountId,
      mediaId: fixture.mediaId,
      purpose: LinkPurpose.Read,
      expiresAt: freshExpiry(),
    });
    const response = await SELF.fetch(
      `${ORIGIN}/m/${fixture.accountId}/${fixture.mediaId}?exp=${exp(query.expiresAt)}&sig=${query.signature}`,
    );
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test.each([
    { label: 'padded', alter: (signature: string) => `${signature}=` },
    { label: 'standard base64', alter: (signature: string) => Buffer.from(signature, 'base64url').toString('base64') },
  ])('a $label signature answers 403', async ({ alter }) => {
    const fixture = await storeMedia();
    const query = await signedQuery({
      key: env.MEDIA_LINK_SIGNING_KEY,
      accountId: fixture.accountId,
      mediaId: fixture.mediaId,
      purpose: LinkPurpose.Read,
      expiresAt: freshExpiry(),
    });
    const response = await SELF.fetch(
      `${ORIGIN}/m/${fixture.accountId}/${fixture.mediaId}?${queryOf({ ...query, signature: encodeURIComponent(alter(query.signature)) })}`,
    );
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test.each([
    { name: 'a repeated signature with the valid one first', build: (query: string) => `${query}&sig=garbage` },
    { name: 'a repeated signature with the valid one last', build: (query: string) => `sig=garbage&${query}` },
    { name: 'a repeated expiry', build: (query: string) => `${query}&exp=1` },
  ])('WI-127 a link with $name answers 403', async ({ build }) => {
    const fixture = await storeMedia();
    const query = await signedQuery({
      key: env.MEDIA_LINK_SIGNING_KEY,
      accountId: fixture.accountId,
      mediaId: fixture.mediaId,
      purpose: LinkPurpose.Read,
      expiresAt: freshExpiry(),
    });
    const response = await SELF.fetch(`${ORIGIN}/m/${fixture.accountId}/${fixture.mediaId}?${build(queryOf(query))}`);
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });
});
