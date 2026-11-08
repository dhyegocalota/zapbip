import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { OwnerLocale, SECOND_MS, START_LINK_PATH, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { changeOf, notificationOf } from '../fixtures/whatsapp/inbound/notification';
import { recordGraphPosts } from '../support/record-graph-posts';
import { applyDirectoryMigration } from '../support/seed';
import { changeStartNumberState, seedStartNumber } from '../support/start-link-numbers';
import { TEST_APP_SECRET } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.50';
const NEW_OWNER_PHONE = '5511900000091';
const FIRST_NUMBER = { numberId: 'num_a', displayNumber: '+5511977770001', digits: '5511977770001', createdAt: 1 };
const SECOND_NUMBER = { numberId: 'num_b', displayNumber: '+5511977770002', digits: '5511977770002', createdAt: 2 };

function locationOfStart(): Promise<string | null> {
  return exports.default
    .fetch(new Request(`${ORIGIN}${START_LINK_PATH}`, { headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS }, redirect: 'manual' }))
    .then((response) => response.headers.get('location'));
}

async function writeTo(input: { numberId: string; id: string }): Promise<Response> {
  const timestamp = String(Math.floor(Date.now() / SECOND_MS));
  const message = { ...textFixture, from: NEW_OWNER_PHONE, id: input.id, timestamp };
  const notification = notificationOf({ changes: [changeOf({ phoneNumberId: `phone-${input.numberId}`, messages: [message] })] });
  const text = JSON.stringify(notification);
  const signature = await signatureHeaderOf({ appSecret: TEST_APP_SECRET, body: new TextEncoder().encode(text) });
  return exports.default.fetch(`${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
    body: text,
  });
}

async function homeNumberOfNewOwner(): Promise<string | null> {
  const row = await testEnv.CONNECTIONS.prepare(
    'SELECT accounts.number_id AS numberId FROM accounts JOIN owner_identities ON owner_identities.account_id = accounts.id WHERE owner_identities.wa_id = ?',
  )
    .bind(NEW_OWNER_PHONE)
    .first<{ numberId: string | null }>();
  return row === null ? null : row.numberId;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedStartNumber({ ...FIRST_NUMBER, state: WhatsAppNumberState.Active });
  await seedStartNumber({ ...SECOND_NUMBER, state: WhatsAppNumberState.Active });
});

afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('start link and accounts', () => {
  it('SL-A1 binds the owner to the number of the link and tells it so when it writes to the other active number', async () => {
    const posts = recordGraphPosts();
    expect(await locationOfStart()).toContain(`/${FIRST_NUMBER.digits}?`);
    expect((await writeTo({ numberId: FIRST_NUMBER.numberId, id: 'wamid.START1' })).status).toBe(200);
    expect(await homeNumberOfNewOwner()).toBe(FIRST_NUMBER.numberId);
    expect((await writeTo({ numberId: SECOND_NUMBER.numberId, id: 'wamid.START2' })).status).toBe(200);
    expect(await homeNumberOfNewOwner()).toBe(FIRST_NUMBER.numberId);
    const expectedNotice = WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.AccountOnOtherNumber].replace(
      '{displayNumber}',
      FIRST_NUMBER.displayNumber,
    );
    expect(posts.map((post) => post.body.text.body)).toContain(expectedNotice);
    expect(posts.find((post) => post.body.text.body === expectedNotice)?.url).toContain(`/phone-${SECOND_NUMBER.numberId}/messages`);
  });

  it('SL-A2 creates no account when the number of a stale link was closed, and sends the next owner to the other number', async () => {
    const posts = recordGraphPosts();
    expect(await locationOfStart()).toContain(`/${FIRST_NUMBER.digits}?`);
    await changeStartNumberState({ numberId: FIRST_NUMBER.numberId, state: WhatsAppNumberState.Closed });
    expect((await writeTo({ numberId: FIRST_NUMBER.numberId, id: 'wamid.STALE1' })).status).toBe(200);
    expect(await homeNumberOfNewOwner()).toBeNull();
    expect(posts.map((post) => post.body.text.body)).toEqual([
      WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.NumberClosedToNewAccounts],
    ]);
    expect(await locationOfStart()).toContain(`/${SECOND_NUMBER.digits}?`);
  });
});
