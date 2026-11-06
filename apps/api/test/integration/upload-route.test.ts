import { env, SELF } from 'cloudflare:test';
import { UPLOAD_TTL_MS } from '@zapbip/core';
import { LinkPurpose } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { freshExpiry, inboxOf, ORIGIN, queryOf, seedAccount, signedQuery, type SeededAccount } from './route-fixtures';

const PDF_TYPE = 'application/pdf';
const PNG_TYPE = 'image/png';
const VIDEO_TYPE = 'video/mp4';
const UPLOAD_BYTES = new TextEncoder().encode('upload-bytes');
const UNKNOWN_UPLOAD_ID = 'med_unknown';
const STATUS_CREATED = 201;
const STATUS_BAD_REQUEST = 400;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_GONE = 410;
const STATUS_LENGTH_REQUIRED = 411;
const STATUS_PAYLOAD_TOO_LARGE = 413;
const STATUS_UNSUPPORTED_MEDIA_TYPE = 415;

type UploadFixture = { account: SeededAccount; uploadId: string };

async function createUpload(input: { account: SeededAccount; mimeType: string }): Promise<UploadFixture> {
  const outcome = await inboxOf({ accountId: input.account.accountId }).createUpload({
    connection: input.account.connection,
    filename: 'file.bin',
    mimeType: input.mimeType,
    sizeBytes: UPLOAD_BYTES.byteLength,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return { account: input.account, uploadId: outcome.value.uploadId };
}

type PutRequest = {
  fixture: UploadFixture;
  pathAccountId: string;
  key: string;
  expiresAt: number;
  uploadId: string;
  headers: Record<string, string>;
  body: Uint8Array;
};

function validPut(input: { fixture: UploadFixture }): PutRequest {
  return {
    fixture: input.fixture,
    pathAccountId: input.fixture.account.accountId,
    key: env.UPLOAD_LINK_SIGNING_KEY,
    expiresAt: freshExpiry(),
    uploadId: input.fixture.uploadId,
    headers: { 'Content-Type': PDF_TYPE, 'Content-Length': String(UPLOAD_BYTES.byteLength) },
    body: UPLOAD_BYTES,
  };
}

async function putUpload(input: PutRequest): Promise<Response> {
  const query = await signedQuery({
    key: input.key,
    accountId: input.fixture.account.accountId,
    mediaId: input.uploadId,
    purpose: LinkPurpose.Upload,
    expiresAt: input.expiresAt,
  });
  return SELF.fetch(`${ORIGIN}/u/${input.pathAccountId}/${input.uploadId}?${queryOf(query)}`, {
    method: 'PUT',
    headers: input.headers,
    body: input.body,
  });
}

function sizedBody(input: { length: number }): Pick<PutRequest, 'body' | 'headers'> {
  return { body: new Uint8Array(input.length), headers: { 'Content-Type': PDF_TYPE, 'Content-Length': String(input.length) } };
}

async function storedObject(input: { fixture: UploadFixture }): Promise<R2Object | null> {
  return env.MEDIA.head(`accounts/${input.fixture.account.accountId}/media/${input.fixture.uploadId}`);
}

async function newFixture({ mimeType = PDF_TYPE }: { mimeType?: string } = {}): Promise<UploadFixture> {
  const account = await seedAccount({ agent: 'alpha' });
  return createUpload({ account, mimeType });
}

describe('upload route', () => {
  test('WI-71 a valid PUT stores the object and answers 201', async () => {
    const fixture = await newFixture();
    const response = await putUpload(validPut({ fixture }));
    expect(response.status).toBe(STATUS_CREATED);
    expect(await storedObject({ fixture })).not.toBeNull();
    const description = await inboxOf({ accountId: fixture.account.accountId }).describeUpload({ mediaId: fixture.uploadId });
    expect(description.ok && description.value.receivedAt).not.toBeNull();
  });

  test('WI-72 a tampered signature answers 403 and stores nothing', async () => {
    const fixture = await newFixture();
    const query = await signedQuery({
      key: env.UPLOAD_LINK_SIGNING_KEY,
      accountId: fixture.account.accountId,
      mediaId: fixture.uploadId,
      purpose: LinkPurpose.Upload,
      expiresAt: freshExpiry(),
    });
    const flipped = query.signature.startsWith('0') ? `1${query.signature.slice(1)}` : `0${query.signature.slice(1)}`;
    const response = await SELF.fetch(
      `${ORIGIN}/u/${fixture.account.accountId}/${fixture.uploadId}?${queryOf({ ...query, signature: flipped })}`,
      { method: 'PUT', headers: { 'Content-Type': PDF_TYPE, 'Content-Length': String(UPLOAD_BYTES.byteLength) }, body: UPLOAD_BYTES },
    );
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-73 an expired signature answers 403 and stores nothing', async () => {
    const fixture = await newFixture();
    const response = await putUpload({ ...validPut({ fixture }), expiresAt: Date.now() - 1 });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-74 an unknown upload id with a valid signature answers 404', async () => {
    const fixture = await newFixture();
    const response = await putUpload({ ...validPut({ fixture }), uploadId: UNKNOWN_UPLOAD_ID });
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-75 an upload past its deadline answers 410 and stores nothing', async () => {
    const fixture = await newFixture();
    await inboxOf({ accountId: fixture.account.accountId }).advanceClock({ advanceMs: UPLOAD_TTL_MS + 1 });
    const response = await putUpload(validPut({ fixture }));
    expect(response.status).toBe(STATUS_GONE);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-76 a second PUT answers 409', async () => {
    const fixture = await newFixture();
    await putUpload(validPut({ fixture }));
    const response = await putUpload(validPut({ fixture }));
    expect(response.status).toBe(STATUS_CONFLICT);
  });

  test('WI-77 a PUT without Content-Length answers 411 and stores nothing', async () => {
    const fixture = await newFixture();
    const query = await signedQuery({
      key: env.UPLOAD_LINK_SIGNING_KEY,
      accountId: fixture.account.accountId,
      mediaId: fixture.uploadId,
      purpose: LinkPurpose.Upload,
      expiresAt: freshExpiry(),
    });
    const chunkedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(UPLOAD_BYTES);
        controller.close();
      },
    });
    const response = await SELF.fetch(`${ORIGIN}/u/${fixture.account.accountId}/${fixture.uploadId}?${queryOf(query)}`, {
      method: 'PUT',
      headers: { 'Content-Type': PDF_TYPE },
      body: chunkedBody,
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(STATUS_LENGTH_REQUIRED);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test.each(['abc', '0x0c', '12abc', '1.2e1', '-12'])('a Content-Length of %j answers 400 and stores nothing', async (contentLength) => {
    const fixture = await newFixture();
    const response = await putUpload({
      ...validPut({ fixture }),
      headers: { 'Content-Type': PDF_TYPE, 'Content-Length': contentLength },
    });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-78 a body larger than declared answers 413 and stores nothing', async () => {
    const fixture = await newFixture();
    const response = await putUpload({ ...validPut({ fixture }), ...sizedBody({ length: UPLOAD_BYTES.byteLength + 1 }) });
    expect(response.status).toBe(STATUS_PAYLOAD_TOO_LARGE);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-79 a body smaller than declared answers 400 and stores nothing', async () => {
    const fixture = await newFixture();
    const response = await putUpload({ ...validPut({ fixture }), ...sizedBody({ length: UPLOAD_BYTES.byteLength - 1 }) });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-80 a wrong Content-Type answers 415 and stores nothing', async () => {
    const fixture = await newFixture();
    const response = await putUpload({
      ...validPut({ fixture }),
      headers: { 'Content-Type': VIDEO_TYPE, 'Content-Length': String(UPLOAD_BYTES.byteLength) },
    });
    expect(response.status).toBe(STATUS_UNSUPPORTED_MEDIA_TYPE);
    expect(await storedObject({ fixture })).toBeNull();
  });

  test('WI-81 type parameters and case are ignored', async () => {
    const fixture = await newFixture({ mimeType: PNG_TYPE });
    const response = await putUpload({
      ...validPut({ fixture }),
      headers: { 'Content-Type': 'IMAGE/PNG; charset=binary', 'Content-Length': String(UPLOAD_BYTES.byteLength) },
    });
    expect(response.status).toBe(STATUS_CREATED);
  });

  test('WI-82 a path without a connection secret carries none of it', async () => {
    const fixture = await newFixture();
    const response = await putUpload(validPut({ fixture }));
    expect(response.status).toBe(STATUS_CREATED);
    expect(response.url).not.toContain(fixture.account.secret);
  });

  test('WI-83 another account in the path answers 403 and stores nothing', async () => {
    const owner = await newFixture();
    const intruder = await seedAccount({ agent: 'alpha' });
    const response = await putUpload({ ...validPut({ fixture: owner }), pathAccountId: intruder.accountId });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await storedObject({ fixture: owner })).toBeNull();
  });

  test('WI-84 a signature made with the media key answers 403', async () => {
    const fixture = await newFixture();
    const response = await putUpload({ ...validPut({ fixture }), key: env.MEDIA_LINK_SIGNING_KEY });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await storedObject({ fixture })).toBeNull();
  });
});
