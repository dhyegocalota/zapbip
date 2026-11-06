import { reset } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createR2MediaStore } from '../../src/adapters/r2/r2-media-store';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_key';
const MEDIA_ID = 'med_key';
const OBJECT_KEY = `accounts/${ACCOUNT_ID}/media/${MEDIA_ID}`;
const BYTES = new Uint8Array([1, 2, 3]);
const MIME_TYPE = 'image/png';

function mediaStore() {
  return createR2MediaStore({
    bucket: testEnv.MEDIA,
    mediaLinkSigningKey: testEnv.MEDIA_LINK_SIGNING_KEY,
    uploadLinkSigningKey: testEnv.UPLOAD_LINK_SIGNING_KEY,
    clock: createPlatformClock(),
  });
}

afterEach(reset);

describe('R2 media store keys', () => {
  it('AK-6 puts, gets and deletes under accounts/<account id>/media/<media id>', async () => {
    const store = mediaStore();
    await store.put({
      accountId: ACCOUNT_ID,
      mediaId: MEDIA_ID,
      body: new Response(BYTES).body as ReadableStream<Uint8Array>,
      sizeBytes: BYTES.byteLength,
      mimeType: MIME_TYPE,
    });
    expect((await testEnv.MEDIA.list()).objects.map((object) => object.key)).toEqual([OBJECT_KEY]);
    expect(await store.get({ accountId: ACCOUNT_ID, mediaId: MEDIA_ID })).toEqual({ bytes: BYTES, mimeType: MIME_TYPE });
    await store.delete({ accountId: ACCOUNT_ID, mediaIds: [MEDIA_ID] });
    expect((await testEnv.MEDIA.list()).objects).toEqual([]);
  });
});
