import { WhatsAppNumberState, OwnerLocale } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { changeOf, notificationOf } from '../fixtures/whatsapp/inbound/notification';
import { recordGraphPosts } from '../support/record-graph-posts';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { seedAccount } from './route-fixtures';
import { nowInSeconds, ownerText, ownerTextsOf, postSignedWith } from './webhook-number-fixtures';

const STATUS_OK = 200;
const UNKNOWN_OWNER_PHONE = '5511900000077';

function numberSeedOf(input: { suffix: string; state: WhatsAppNumberState }) {
  return {
    numberId: `num_${input.suffix}`,
    metaAppRef: `mapp_${input.suffix}`,
    phoneNumberId: `10000000000${input.suffix}`,
    wabaId: `30000000000${input.suffix}`,
    accessToken: `token-${input.suffix}`,
    appSecret: `secret-${input.suffix}`,
    displayNumber: `55119000${input.suffix}`,
    state: input.state,
  };
}

function spyOnLogs() {
  return [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
}

function loggedText(input: { spies: ReturnType<typeof spyOnLogs> }): string {
  return JSON.stringify(input.spies.flatMap((spy) => spy.mock.calls));
}

async function accountCountFor(input: { waId: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM owner_identities WHERE wa_id = ?')
    .bind(input.waId)
    .first<{ total: number }>();
  if (row === null) throw new Error('count row is missing');
  return row.total;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('number states on inbound', () => {
  test.each([
    { suffix: '0021', state: WhatsAppNumberState.Pending, event: OperatorEvent.InboundNumberPending },
    { suffix: '0022', state: WhatsAppNumberState.Disabled, event: OperatorEvent.InboundNumberDisabled },
  ])('a $state number answers 200, stores nothing and logs $event', async ({ suffix, state, event }) => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const seed = numberSeedOf({ suffix, state });
    await seedWhatsAppNumber(seed);
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: seed.phoneNumberId, messages: [ownerText({ account, id: `wamid.STATE${suffix}` })] })],
    });
    const response = await postSignedWith({ appSecret: seed.appSecret, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(await ownerTextsOf({ account })).toEqual([]);
    expect(loggedText({ spies })).toContain(event);
  });

  test('a closed number creates no account for a new owner and sends one notice from that number', async () => {
    const spies = spyOnLogs();
    const posts = recordGraphPosts();
    await seedAccount({ agent: 'alpha' });
    const seed = numberSeedOf({ suffix: '0023', state: WhatsAppNumberState.Closed });
    await seedWhatsAppNumber(seed);
    const message = { ...textFixture, from: UNKNOWN_OWNER_PHONE, id: 'wamid.CLOSED', timestamp: nowInSeconds() };
    const notification = notificationOf({ changes: [changeOf({ phoneNumberId: seed.phoneNumberId, messages: [message] })] });
    const response = await postSignedWith({ appSecret: seed.appSecret, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(await accountCountFor({ waId: UNKNOWN_OWNER_PHONE })).toBe(0);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toContain(`/${seed.phoneNumberId}/messages`);
    expect(posts[0]?.authorization).toBe(`Bearer ${seed.accessToken}`);
    expect(posts[0]?.body.to).toBe(UNKNOWN_OWNER_PHONE);
    expect(posts[0]?.body.text.body).toBe(WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.NumberClosedToNewAccounts]);
    expect(loggedText({ spies })).toContain(OperatorEvent.InboundNumberClosed);
  });
});
