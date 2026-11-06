import { createHash } from 'node:crypto';
import { ChannelError, type MediaStore } from '@zapbip/core';
import { ChannelErrorKind, MessageKind } from '@zapbip/types';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphClient } from '../../src/adapters/whatsapp/graph-client';
import type { MediaDownloadRequest } from '../../src/adapters/whatsapp/inbound-parser';
import { downloadInboundMedia, RetriableMediaError } from '../../src/adapters/whatsapp/media-download';
import { MEDIA_DOWNLOAD_ATTEMPTS, MEDIA_MAX_BYTES_INBOUND } from '../../src/adapters/whatsapp/whatsapp-constants';
import { WhatsAppErrorCode } from '../../src/adapters/whatsapp/whatsapp-enums';

const ACCOUNT_ID = 'acc_a';
const MEDIA_ID = 'med_abc';
const ALLOWED_URL = 'https://media.fbsbx.com/x';
const BODY = new TextEncoder().encode('image-bytes');
const STATUS_NOT_FOUND = 404;
const STATUS_FOUND = 302;
const STATUS_SERVER_ERROR = 500;
const OVER_LIMIT_BYTES = MEDIA_MAX_BYTES_INBOUND + 1;

class TestDigestStream extends WritableStream<Uint8Array> {
  readonly digest: Promise<ArrayBuffer>;

  constructor(algorithm: string) {
    const chunks: Uint8Array[] = [];
    let resolveDigest: (digest: ArrayBuffer) => void = () => undefined;
    super({
      write(chunk) {
        chunks.push(chunk);
      },
      close() {
        const digest = createHash(algorithm.replace('-', '').toLowerCase()).update(Buffer.concat(chunks)).digest();
        resolveDigest(digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength) as ArrayBuffer);
      },
    });
    this.digest = new Promise((resolve) => {
      resolveDigest = resolve;
    });
  }
}

type Download = Response | Error;
type Metadata = Record<string, unknown> | Error;
type StoredObject = { bytes: Uint8Array; sizeBytes: number; mimeType: string };

function sha256Base64Of(input: { bytes: Uint8Array }): string {
  return createHash('sha256').update(input.bytes).digest('base64');
}

function metadataOf(input: { url?: string; fileSize?: number }): Metadata {
  return {
    url: input.url === undefined ? ALLOWED_URL : input.url,
    file_size: input.fileSize === undefined ? BODY.byteLength : input.fileSize,
  };
}

function bodyResponse(input: { bytes?: Uint8Array } = {}): Response {
  return new Response(input.bytes === undefined ? BODY : input.bytes);
}

function fakeGraph(input: { metadata: Metadata[]; downloads: Download[] }) {
  const metadataPaths: string[] = [];
  const downloadedUrls: string[] = [];
  const metadata = [...input.metadata];
  const downloads = [...input.downloads];
  const graph: GraphClient = {
    async post() {
      throw new Error('post is not used');
    },
    async get({ path }) {
      metadataPaths.push(path);
      const next = metadata.shift();
      if (next === undefined) throw new Error('no scripted metadata');
      if (next instanceof Error) throw next;
      return next;
    },
    async download({ url }) {
      downloadedUrls.push(url);
      const next = downloads.shift();
      if (next === undefined) throw new Error('no scripted download');
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { graph, metadataPaths, downloadedUrls };
}

function memoryStore() {
  const objects = new Map<string, StoredObject>();
  const mediaStore: MediaStore = {
    async put({ accountId, mediaId, body, sizeBytes, mimeType }) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      objects.set(`${accountId}/${mediaId}`, { bytes, sizeBytes, mimeType });
    },
    async get() {
      return null;
    },
    async signedLink() {
      return '';
    },
    async delete({ accountId, mediaIds }) {
      mediaIds.forEach((mediaId) => objects.delete(`${accountId}/${mediaId}`));
    },
  };
  return { mediaStore, objects };
}

function requestOf(input: { bytes?: Uint8Array } = {}): MediaDownloadRequest {
  return {
    mediaId: MEDIA_ID,
    channelMediaId: '900000000000001',
    mimeType: 'image/jpeg',
    sha256Base64: sha256Base64Of({ bytes: input.bytes === undefined ? BODY : input.bytes }),
    filename: null,
    caption: null,
    mediaKind: MessageKind.Image,
  };
}

function download(input: { metadata: Metadata[]; downloads: Download[]; request?: MediaDownloadRequest }) {
  const graphDouble = fakeGraph(input);
  const storeDouble = memoryStore();
  const result = downloadInboundMedia({
    graph: graphDouble.graph,
    mediaStore: storeDouble.mediaStore,
    accountId: ACCOUNT_ID,
    request: input.request === undefined ? requestOf() : input.request,
    maxBytes: MEDIA_MAX_BYTES_INBOUND,
    attempts: MEDIA_DOWNLOAD_ATTEMPTS,
  });
  return { result, ...graphDouble, ...storeDouble };
}

beforeAll(() => {
  Object.defineProperty(crypto, 'DigestStream', { value: TestDigestStream, configurable: true });
});

describe('downloadInboundMedia', () => {
  it('AU-59 stores bytes whose digest matches and reports the size', async () => {
    const run = download({ metadata: [metadataOf({})], downloads: [bodyResponse()] });
    expect(await run.result).toEqual({ stored: true, sizeBytes: BODY.byteLength });
    expect(run.objects.get(`${ACCOUNT_ID}/${MEDIA_ID}`)).toEqual({ bytes: BODY, sizeBytes: BODY.byteLength, mimeType: 'image/jpeg' });
    expect(run.metadataPaths).toEqual(['/900000000000001']);
  });

  it('AU-60 deletes the object when the digest differs', async () => {
    const run = download({
      metadata: [metadataOf({})],
      downloads: [bodyResponse()],
      request: requestOf({ bytes: new Uint8Array([1, 2, 3]) }),
    });
    expect(await run.result).toEqual({ stored: false });
    expect(run.objects.size).toBe(0);
  });

  it('AU-61 deletes the object when the body is longer than the declared size', async () => {
    const run = download({ metadata: [metadataOf({ fileSize: BODY.byteLength - 1 })], downloads: [bodyResponse()] });
    expect(await run.result).toEqual({ stored: false });
    expect(run.objects.size).toBe(0);
  });

  it('deletes the object when the body is shorter than the declared size', async () => {
    const run = download({ metadata: [metadataOf({ fileSize: BODY.byteLength + 1 })], downloads: [bodyResponse()] });
    expect(await run.result).toEqual({ stored: false });
    expect(run.objects.size).toBe(0);
  });

  it('AU-62 refreshes the metadata once after a 404 and stores', async () => {
    const run = download({
      metadata: [metadataOf({ url: 'https://media.fbsbx.com/old' }), metadataOf({ url: 'https://media.fbsbx.com/new' })],
      downloads: [new Response(null, { status: STATUS_NOT_FOUND }), bodyResponse()],
    });
    expect(await run.result).toEqual({ stored: true, sizeBytes: BODY.byteLength });
    expect(run.metadataPaths).toHaveLength(2);
    expect(run.downloadedUrls).toEqual(['https://media.fbsbx.com/old', 'https://media.fbsbx.com/new']);
  });

  it('AU-63 gives up after a second 404 with no third request', async () => {
    const run = download({
      metadata: [metadataOf({}), metadataOf({})],
      downloads: [new Response(null, { status: STATUS_NOT_FOUND }), new Response(null, { status: STATUS_NOT_FOUND })],
    });
    expect(await run.result).toEqual({ stored: false });
    expect(run.metadataPaths).toHaveLength(2);
    expect(run.downloadedUrls).toHaveLength(2);
  });

  it('AU-64 throws a retriable error on a 5xx and stores nothing', async () => {
    const run = download({ metadata: [metadataOf({})], downloads: [new Response(null, { status: STATUS_SERVER_ERROR })] });
    await expect(run.result).rejects.toBeInstanceOf(RetriableMediaError);
    expect(run.objects.size).toBe(0);
  });

  it('AU-65 throws the same retriable error when the download fails to answer', async () => {
    const run = download({ metadata: [metadataOf({})], downloads: [new DOMException('timed out', 'AbortError')] });
    await expect(run.result).rejects.toBeInstanceOf(RetriableMediaError);
  });

  it('throws a retriable error when the metadata request times out', async () => {
    const timeout = new ChannelError({ kind: ChannelErrorKind.Timeout, message: 'timeout', errorCode: null });
    const run = download({ metadata: [timeout], downloads: [] });
    await expect(run.result).rejects.toBeInstanceOf(RetriableMediaError);
  });

  it('rethrows any other metadata error', async () => {
    const auth = new ChannelError({ kind: ChannelErrorKind.Auth, message: 'auth', errorCode: WhatsAppErrorCode.AuthOAuth });
    const run = download({ metadata: [auth], downloads: [] });
    await expect(run.result).rejects.toBe(auth);
  });

  it('AU-66 treats a redirect as unavailable and requests nothing else', async () => {
    const redirect = new Response(null, { status: STATUS_FOUND, headers: { location: 'https://evil.example.com/x' } });
    const run = download({ metadata: [metadataOf({})], downloads: [redirect] });
    expect(await run.result).toEqual({ stored: false });
    expect(run.downloadedUrls).toEqual([ALLOWED_URL]);
  });

  it.each([
    ['AU-67 userinfo trick', 'https://lookaside.fbsbx.com@evil.com/x'],
    ['AU-68 path trick', 'https://evil.com/.fbsbx.com/x'],
    ['AU-70 plain http', 'http://lookaside.fbsbx.com/x'],
    ['suffix without a dot boundary', 'https://evilfbsbx.com/x'],
    ['not a URL', 'not a url'],
  ])('%s is unavailable and nothing is requested', async (_name, url) => {
    const run = download({ metadata: [metadataOf({ url })], downloads: [] });
    expect(await run.result).toEqual({ stored: false });
    expect(run.downloadedUrls).toEqual([]);
  });

  it.each(['https://media.fbsbx.com/x', 'https://scontent.xx.fbcdn.net/x', 'https://mmg.whatsapp.net/x', 'https://fbsbx.com/x'])(
    'AU-69 requests the allowed host %s',
    async (url) => {
      const run = download({ metadata: [metadataOf({ url })], downloads: [bodyResponse()] });
      expect(await run.result).toEqual({ stored: true, sizeBytes: BODY.byteLength });
      expect(run.downloadedUrls).toEqual([url]);
    },
  );

  it('AU-71 refuses a declared size over the limit without downloading', async () => {
    const run = download({ metadata: [metadataOf({ fileSize: OVER_LIMIT_BYTES })], downloads: [] });
    expect(await run.result).toEqual({ stored: false });
    expect(run.downloadedUrls).toEqual([]);
    expect(run.objects.size).toBe(0);
  });

  it('AU-72 treats Meta error 131052 on the metadata as unavailable', async () => {
    const tooLarge = new ChannelError({
      kind: ChannelErrorKind.Unknown,
      message: 'too large',
      errorCode: WhatsAppErrorCode.InboundMediaTooLarge,
    });
    const run = download({ metadata: [tooLarge], downloads: [] });
    expect(await run.result).toEqual({ stored: false });
  });

  it('propagates a store failure that is not a length violation', async () => {
    const graphDouble = fakeGraph({ metadata: [metadataOf({})], downloads: [bodyResponse()] });
    const failingStore: MediaStore = {
      ...memoryStore().mediaStore,
      async put() {
        throw new Error('r2 down');
      },
    };
    const result = downloadInboundMedia({
      graph: graphDouble.graph,
      mediaStore: failingStore,
      accountId: ACCOUNT_ID,
      request: requestOf(),
      maxBytes: MEDIA_MAX_BYTES_INBOUND,
      attempts: MEDIA_DOWNLOAD_ATTEMPTS,
    });
    await expect(result).rejects.toThrow('r2 down');
  });
});
