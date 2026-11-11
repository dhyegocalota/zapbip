import { SELF } from 'cloudflare:test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app';
import { MAX_FUTURE_SKEW_MS, WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import { changeOf, notificationOf, OUR_PHONE_NUMBER_ID } from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { testEnv } from '../support/workers-env';
import { TEST_META_APP_SECRET } from '../support/meta-app-secret';
import { seedWhatsAppNumber, TEST_WABA_ID } from '../support/whatsapp-numbers';
import { ORIGIN, seedAccount } from './route-fixtures';
import { ownerText, ownerTextsOf, postSignedWith } from './webhook-number-fixtures';

const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const WEBHOOK_URL = `${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`;
const SECOND_NUMBER_ID = 'num_second';
const SECOND_PHONE_NUMBER_ID = '1000000000000002';
const OTHER_APP_SECRET = 'another-app-secret';
const UNKNOWN_PHONE_NUMBER_ID = '9999999999999999';
const TEMPLATE_STATUS_FIELD = 'message_template_status_update';
const BAD_SIGNATURE_BODY = { error: 'unauthorized' };

afterEach(() => {
  vi.restoreAllMocks();
});

const secondNumberSeed: { promise: Promise<unknown> | null } = { promise: null };

function seedSecondNumber(): Promise<unknown> {
  if (secondNumberSeed.promise !== null) return secondNumberSeed.promise;
  secondNumberSeed.promise = seedWhatsAppNumber({
    numberId: SECOND_NUMBER_ID,
    phoneNumberId: SECOND_PHONE_NUMBER_ID,
    wabaId: '3000000000000004',
    displayNumber: '5511900000002',
  });
  return secondNumberSeed.promise;
}

describe('webhook attribution by number', () => {
  test('a body signed with the Meta app secret reaches the account', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({ changes: [changeOf({ messages: [ownerText({ account, id: 'wamid.NUM1' })] })] });
    const response = await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(await ownerTextsOf({ account })).toEqual(['Oi']);
  });

  test('a body of the second number signed with the same secret is accepted', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    await seedSecondNumber();
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: SECOND_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.NUM2' })] })],
    });
    const response = await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_OK);
  });

  test('a body signed with any other secret answers 401 and stores nothing', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({ changes: [changeOf({ messages: [ownerText({ account, id: 'wamid.NUM3' })] })] });
    const response = await postSignedWith({ appSecret: OTHER_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual(BAD_SIGNATURE_BODY);
    expect(await ownerTextsOf({ account })).toEqual([]);
  });

  test('a missing Meta app secret fails closed: even a correctly signed body answers 401', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({ changes: [changeOf({ messages: [ownerText({ account, id: 'wamid.NUM8' })] })] });
    const text = JSON.stringify(notification);
    const signature = await signatureHeaderOf({ appSecret: TEST_META_APP_SECRET, body: new TextEncoder().encode(text) });
    const request = new Request(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body: text });
    const app = createApp({ extraRoutes: [], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS });
    const response = await app.fetch(request, { ...testEnv, META_APP_SECRET: undefined });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await ownerTextsOf({ account })).toEqual([]);
  });

  test('an unknown phone number id answers 401 with the body of a bad signature and logs it unattributed', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: UNKNOWN_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.NUM4' })] })],
    });
    const response = await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual(BAD_SIGNATURE_BODY);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.InboundUnattributed);
    expect(await ownerTextsOf({ account })).toEqual([]);
  });

  test('an unknown change beside a known one is skipped and the signature is checked with the Meta app secret', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ phoneNumberId: UNKNOWN_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.NUM6A' })] }),
        changeOf({ phoneNumberId: OUR_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.NUM6B' })] }),
      ],
    });
    const wrongSecret = await postSignedWith({ appSecret: OTHER_APP_SECRET, notification });
    expect(wrongSecret.status).toBe(STATUS_UNAUTHORIZED);
    const rightSecret = await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(rightSecret.status).toBe(STATUS_OK);
    expect(await ownerTextsOf({ account })).toEqual(['Oi']);
  });

  test('an unknown phone number id costs one signature check against a dummy secret, like a known one', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const verify = vi.spyOn(crypto.subtle, 'verify');
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: UNKNOWN_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.NUM7' })] })],
    });
    await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  test('a template status change addressed by the WABA id and signed with the Meta app secret is acknowledged', async () => {
    await seedAccount({ agent: 'alpha' });
    const templateStatus = { field: TEMPLATE_STATUS_FIELD, value: { event: 'APPROVED', message_template_name: 'zapbip_agent_notice' } };
    const notification = { object: 'whatsapp_business_account', entry: [{ id: TEST_WABA_ID, changes: [templateStatus] }] };
    const response = await postSignedWith({ appSecret: TEST_META_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_OK);
  });

  test('a template status change signed with another secret answers 401', async () => {
    await seedAccount({ agent: 'alpha' });
    const templateStatus = { field: TEMPLATE_STATUS_FIELD, value: { event: 'APPROVED' } };
    const notification = { object: 'whatsapp_business_account', entry: [{ id: TEST_WABA_ID, changes: [templateStatus] }] };
    const response = await postSignedWith({ appSecret: OTHER_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('a body that is not JSON answers 401 with the body of a bad signature', async () => {
    await seedAccount({ agent: 'alpha' });
    const signature = await signatureHeaderOf({ appSecret: TEST_META_APP_SECRET, body: new TextEncoder().encode('not json') });
    const response = await SELF.fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
      body: 'not json',
    });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual(BAD_SIGNATURE_BODY);
  });
});
