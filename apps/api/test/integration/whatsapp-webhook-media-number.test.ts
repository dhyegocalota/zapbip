import { afterEach, describe, expect, test, vi } from 'vitest';
import imageFixture from '../fixtures/whatsapp/inbound/image.json';
import { changeOf, notificationOf } from '../fixtures/whatsapp/inbound/notification';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { seedAccount } from './route-fixtures';
import { nowInSeconds, postSignedWith } from './webhook-number-fixtures';

const STATUS_OK = 200;
const IMAGE_BYTES = new TextEncoder().encode('image-bytes');
const IMAGE_DOWNLOAD_URL = 'https://media.fbsbx.com/image';
const SECURE_PREFIX = 'https://';
const SECOND_NUMBER = {
  numberId: 'num_0041',
  metaAppRef: 'mapp_0041',
  phoneNumberId: '1000000000041',
  wabaId: '3000000000041',
  accessToken: 'token-0041',
  appSecret: 'secret-0041',
  displayNumber: '5511900000041',
};

afterEach(() => {
  vi.restoreAllMocks();
});

function recordMediaAuthorizations(): string[] {
  const authorizations: string[] = [];
  const passthrough = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = String(request instanceof Request ? request.url : request);
    const isMediaRequest = url.endsWith(`/${imageFixture.image.id}`) || url.startsWith(SECURE_PREFIX);
    if (!isMediaRequest) return passthrough(request, init);
    authorizations.push(String(new Headers(init?.headers).get('authorization')));
    if (url.startsWith(SECURE_PREFIX)) return new Response(IMAGE_BYTES);
    return Response.json({ url: IMAGE_DOWNLOAD_URL, file_size: IMAGE_BYTES.byteLength });
  });
  return authorizations;
}

describe('inbound media on the second number', () => {
  test('pin: the metadata request and the download carry the token of the receiving number', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const authorizations = recordMediaAuthorizations();
    const account = await seedAccount({ agent: 'alpha' });
    await seedWhatsAppNumber(SECOND_NUMBER);
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET number_id = ? WHERE id = ?')
      .bind(SECOND_NUMBER.numberId, account.accountId)
      .run();
    const message = { ...imageFixture, from: account.phone, id: 'wamid.MEDIA2', timestamp: nowInSeconds() };
    const notification = notificationOf({ changes: [changeOf({ phoneNumberId: SECOND_NUMBER.phoneNumberId, messages: [message] })] });
    const response = await postSignedWith({ appSecret: SECOND_NUMBER.appSecret, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(authorizations).toEqual([`Bearer ${SECOND_NUMBER.accessToken}`, `Bearer ${SECOND_NUMBER.accessToken}`]);
  });
});
