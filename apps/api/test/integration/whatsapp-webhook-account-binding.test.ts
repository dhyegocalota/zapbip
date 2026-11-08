import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { receiveOwnerInbound } from '../../src/inbound/owner-inbound';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { changeOf, notificationOf } from '../fixtures/whatsapp/inbound/notification';
import { seedOwnerIdentity } from '../support/seed';
import {
  seedWhatsAppNumber,
  TEST_APP_SECRET,
  TEST_DISPLAY_NUMBER,
  TEST_NUMBER_ID,
  TEST_PHONE_NUMBER_ID,
  TEST_REGISTERED_NUMBER,
} from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { seedAccount } from './route-fixtures';
import { nowInSeconds, ownerText, ownerTextsOf, postSignedWith } from './webhook-number-fixtures';
import { OwnerLocale } from '@zapbip/types';

const STATUS_OK = 200;
const NEW_OWNER_PHONE = '5511900000066';
const LATE_OWNER_PHONE = '5511900000068';
const UNBOUND_OWNER_PHONE = '5511900000067';
const LEAVING_OWNER_PHONE = '5511900000069';
const MESSAGES_PATH_SUFFIX = '/messages';
const SECOND = {
  numberId: 'num_0031',
  metaAppRef: 'mapp_0031',
  phoneNumberId: '1000000000031',
  wabaId: '3000000000031',
  accessToken: 'token-0031',
  appSecret: 'secret-0031',
  displayNumber: '5511900000031',
  state: WhatsAppNumberState.Active,
};

const THIRD = {
  ...SECOND,
  numberId: 'num_0033',
  metaAppRef: 'mapp_0033',
  phoneNumberId: '1000000000033',
  wabaId: '3000000000033',
  displayNumber: '5511900000033',
};

type GraphPost = { url: string; authorization: string | null; body: { to: string; text: { body: string } } };

function recordGraphPosts(): GraphPost[] {
  const posts: GraphPost[] = [];
  const passthrough = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = String(request instanceof Request ? request.url : request);
    if (!url.endsWith(MESSAGES_PATH_SUFFIX)) return passthrough(request, init);
    const authorization = new Headers(init?.headers).get('authorization');
    posts.push({ url, authorization, body: JSON.parse(String(init?.body)) as GraphPost['body'] });
    return Response.json({ messages: [{ id: `wamid.NOTICE${posts.length}` }] });
  });
  return posts;
}

async function homeNumberOf(input: { waId: string }): Promise<string | null> {
  const row = await testEnv.CONNECTIONS.prepare(
    'SELECT accounts.number_id AS numberId FROM accounts JOIN owner_identities ON owner_identities.account_id = accounts.id WHERE owner_identities.wa_id = ?',
  )
    .bind(input.waId)
    .first<{ numberId: string | null }>();
  if (row === null) throw new Error('account is missing');
  return row.numberId;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('account binding to a number', () => {
  test('a new owner is bound to the number it first wrote to', async () => {
    await seedAccount({ agent: 'alpha' });
    const message = { ...textFixture, from: NEW_OWNER_PHONE, id: 'wamid.BIND1', timestamp: nowInSeconds() };
    const notification = notificationOf({ changes: [changeOf({ messages: [message] })] });
    const response = await postSignedWith({ appSecret: TEST_APP_SECRET, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(await homeNumberOf({ waId: NEW_OWNER_PHONE })).toBe(TEST_NUMBER_ID);
  });

  test('a new owner on a number the registry lacks gets no account', async () => {
    const missing = { ...TEST_REGISTERED_NUMBER, numberId: 'num_missing' };
    await seedAccount({ agent: 'alpha' });
    await expect(
      receiveOwnerInbound({
        number: missing,
        bindings: testEnv,
        waId: LATE_OWNER_PHONE,
        channelMessageId: 'wamid.BIND2',
        entryOf: async () => {
          throw new Error('no entry expected');
        },
      }),
    ).rejects.toThrow();
    const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM owner_identities WHERE wa_id = ?')
      .bind(LATE_OWNER_PHONE)
      .first<{ total: number }>();
    expect(row).toEqual({ total: 0 });
  });

  test('the owner of an account on one number is answered from the other number and not routed', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const posts = recordGraphPosts();
    const account = await seedAccount({ agent: 'alpha' });
    await seedWhatsAppNumber(SECOND);
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: SECOND.phoneNumberId, messages: [ownerText({ account, id: 'wamid.BIND3' })] })],
    });
    const response = await postSignedWith({ appSecret: SECOND.appSecret, notification });
    expect(response.status).toBe(STATUS_OK);
    expect(await ownerTextsOf({ account })).toEqual([]);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toContain(`/${SECOND.phoneNumberId}/messages`);
    expect(posts[0]?.authorization).toBe(`Bearer ${SECOND.accessToken}`);
    expect(posts[0]?.body.to).toBe(account.phone);
    const expectedText = WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.AccountOnOtherNumber].replace(
      '{displayNumber}',
      TEST_DISPLAY_NUMBER,
    );
    expect(posts[0]?.body.text.body).toBe(expectedText);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.InboundAccountOnOtherNumber);
  });

  test('an account without a home number is dropped with a log, never thrown at Meta', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    await seedAccount({ agent: 'alpha' });
    await seedOwnerIdentity({ accountId: 'acc_unbound', phone: UNBOUND_OWNER_PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    const result = await receiveOwnerInbound({
      number: { ...TEST_REGISTERED_NUMBER, phoneNumberId: TEST_PHONE_NUMBER_ID },
      bindings: testEnv,
      waId: UNBOUND_OWNER_PHONE,
      channelMessageId: 'wamid.BIND4',
      entryOf: async () => {
        throw new Error('no entry expected');
      },
    });
    expect(result).toEqual({ messageId: null, agent: null, duplicate: false });
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.InboundAccountWithoutNumber);
  });

  test('an account being deleted is not told about another number', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const posts = recordGraphPosts();
    await seedAccount({ agent: 'alpha' });
    await seedWhatsAppNumber(THIRD);
    await seedOwnerIdentity({
      accountId: 'acc_leaving',
      phone: LEAVING_OWNER_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    await testEnv.CONNECTIONS.prepare("UPDATE accounts SET state = 'deleting' WHERE id = ?").bind('acc_leaving').run();
    await receiveOwnerInbound({
      number: { ...TEST_REGISTERED_NUMBER, numberId: THIRD.numberId, phoneNumberId: THIRD.phoneNumberId },
      bindings: testEnv,
      waId: LEAVING_OWNER_PHONE,
      channelMessageId: 'wamid.BIND5',
      entryOf: async () => {
        throw new Error('no entry expected');
      },
    });
    expect(posts).toHaveLength(0);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).not.toContain(OperatorEvent.InboundAccountOnOtherNumber);
  });
});
