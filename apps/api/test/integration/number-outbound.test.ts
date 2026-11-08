import { ChannelError, type CoreDependencies } from '@zapbip/core';
import { ChannelErrorKind, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountInbox } from '../../src/account-inbox/account-inbox';
import { D1ChannelRestrictions } from '../../src/adapters/d1/d1-channel-restrictions';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { accessTokenAssociatedData } from '../../src/numbers/number-sealing';
import { buildTextMessage } from '../support/builders';
import { FakeGraph } from '../support/fake-graph';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { seedWhatsAppNumber, TEST_ACCESS_TOKEN, TEST_NUMBER_ID, testSecretBox } from '../support/whatsapp-numbers';
import { accountInboxStub, testEnv, whatsappTestEnv } from '../support/workers-env';

const FIRST_ACCOUNT = 'acc_on_first';
const SECOND_ACCOUNT = 'acc_on_second';
const UNBOUND_ACCOUNT = 'acc_unbound';
const FIRST_OWNER_WA_ID = '5511900000001';
const SECOND_OWNER_WA_ID = '5511900000002';
const UNBOUND_OWNER_WA_ID = '5511900000003';
const ROTATED_ACCESS_TOKEN = 'rotated-access-token';
const RESTRICTED_ERROR_CODE = 131_048;
const FIRST_PHONE_NUMBER_ID = '1000000000000101';
const SECOND_NUMBER = {
  numberId: 'num_second',
  metaAppRef: 'mapp_second',
  phoneNumberId: '1000000000002',
  wabaId: '3000000000002',
  accessToken: 'second-access-token',
  appSecret: 'second-app-secret',
  displayNumber: '5511966660000',
};

const fakeGraph = new FakeGraph({
  baseUrl: readWhatsAppEnvironment({ env: testEnv }).graphBaseUrl,
  resourceIds: [FIRST_PHONE_NUMBER_ID, SECOND_NUMBER.phoneNumberId],
});

type SendOutcome = { delivered: true } | { delivered: false; code: string };
type SenderSelection = { createSender: (input: { mediaStore: CoreDependencies['mediaStore'] }) => CoreDependencies['sender'] };

function sendFrom(input: { accountId: string; text: string }): Promise<SendOutcome> {
  return runInDurableObject(accountInboxStub({ accountId: input.accountId }), async (instance) => {
    const internals = instance as unknown as { dependencies: CoreDependencies };
    const withCloudApiEnvironment = Object.create(instance, { env: { value: whatsappTestEnv } }) as SenderSelection;
    const createSender = (AccountInbox.prototype as unknown as SenderSelection).createSender;
    const sender = createSender.call(withCloudApiEnvironment, { mediaStore: internals.dependencies.mediaStore });
    try {
      await sender.session({
        message: buildTextMessage({ messageId: 'msg_1', text: input.text }),
        question: null,
        replyToChannelMessageId: null,
        reactionTargetChannelMessageId: null,
      });
      return { delivered: true };
    } catch (error) {
      if (error instanceof ChannelError) return { delivered: false, code: error.code };
      throw error;
    }
  });
}

async function sendsTo(input: { phoneNumberId: string }) {
  const requests = await fakeGraph.requests();
  return requests.filter((request) => request.path.endsWith(`/${input.phoneNumberId}/messages`));
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedWhatsAppNumber({ phoneNumberId: FIRST_PHONE_NUMBER_ID });
  await seedWhatsAppNumber(SECOND_NUMBER);
  await seedOwnerIdentity({
    accountId: FIRST_ACCOUNT,
    phone: FIRST_OWNER_WA_ID,
    ownerLocale: OwnerLocale.PortugueseBrazil,
    numberId: TEST_NUMBER_ID,
  });
  await seedOwnerIdentity({
    accountId: SECOND_ACCOUNT,
    phone: SECOND_OWNER_WA_ID,
    ownerLocale: OwnerLocale.PortugueseBrazil,
    numberId: SECOND_NUMBER.numberId,
  });
  await seedOwnerIdentity({ accountId: UNBOUND_ACCOUNT, phone: UNBOUND_OWNER_WA_ID, ownerLocale: OwnerLocale.PortugueseBrazil });
  await fakeGraph.reset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('outbound per number', () => {
  it('sends from the number of the account with the token of that number', async () => {
    expect(await sendFrom({ accountId: FIRST_ACCOUNT, text: 'um' })).toEqual({ delivered: true });
    expect(await sendFrom({ accountId: SECOND_ACCOUNT, text: 'dois' })).toEqual({ delivered: true });
    const [onFirst] = await sendsTo({ phoneNumberId: FIRST_PHONE_NUMBER_ID });
    const [onSecond] = await sendsTo({ phoneNumberId: SECOND_NUMBER.phoneNumberId });
    expect(onFirst?.headers.authorization).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);
    expect(onFirst?.body).toMatchObject({ to: FIRST_OWNER_WA_ID });
    expect(onSecond?.headers.authorization).toBe(`Bearer ${SECOND_NUMBER.accessToken}`);
    expect(onSecond?.body).toMatchObject({ to: SECOND_OWNER_WA_ID });
  });

  it('uses the rotated token on the send after the rotation', async () => {
    await sendFrom({ accountId: FIRST_ACCOUNT, text: 'antes' });
    const sealed = await testSecretBox().seal({
      plain: ROTATED_ACCESS_TOKEN,
      associatedData: accessTokenAssociatedData({ numberId: TEST_NUMBER_ID }),
    });
    await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET sealed_access_token = ? WHERE id = ?')
      .bind(sealed, TEST_NUMBER_ID)
      .run();
    await sendFrom({ accountId: FIRST_ACCOUNT, text: 'depois' });
    const sends = await sendsTo({ phoneNumberId: FIRST_PHONE_NUMBER_ID });
    expect(sends.map((request) => request.headers.authorization)).toEqual([
      `Bearer ${TEST_ACCESS_TOKEN}`,
      `Bearer ${ROTATED_ACCESS_TOKEN}`,
    ]);
  });

  it.each([WhatsAppNumberState.Pending, WhatsAppNumberState.Disabled])(
    'refuses a send from a %s number with the restricted-channel error and logs channel.number_unavailable',
    async (state) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET state = ? WHERE id = ?').bind(state, TEST_NUMBER_ID).run();
      expect(await sendFrom({ accountId: FIRST_ACCOUNT, text: 'um' })).toEqual({ delivered: false, code: ChannelErrorKind.Restricted });
      expect(await sendsTo({ phoneNumberId: FIRST_PHONE_NUMBER_ID })).toEqual([]);
      const logged = JSON.stringify([...errorSpy.mock.calls, ...logSpy.mock.calls]);
      expect(logged).toContain(OperatorEvent.ChannelNumberUnavailable);
      expect(logged).not.toContain(TEST_ACCESS_TOKEN);
    },
  );

  it('refuses a send from an account without a number', async () => {
    expect(await sendFrom({ accountId: UNBOUND_ACCOUNT, text: 'um' })).toEqual({ delivered: false, code: ChannelErrorKind.Restricted });
  });

  it('records a restriction for the phone number id that Meta restricted and not for the other', async () => {
    await fakeGraph.respondWith({
      method: 'POST',
      path: `/v24.0/${FIRST_PHONE_NUMBER_ID}/messages`,
      status: 400,
      body: { error: { code: RESTRICTED_ERROR_CODE, message: 'refused' } },
    });
    expect(await sendFrom({ accountId: FIRST_ACCOUNT, text: 'um' })).toEqual({ delivered: false, code: ChannelErrorKind.Restricted });
    const now = createPlatformClock().now();
    const first = new D1ChannelRestrictions({ database: testEnv.CONNECTIONS, phoneNumberId: FIRST_PHONE_NUMBER_ID });
    const second = new D1ChannelRestrictions({ database: testEnv.CONNECTIONS, phoneNumberId: SECOND_NUMBER.phoneNumberId });
    expect(await first.findActive({ now })).toEqual({ errorCode: RESTRICTED_ERROR_CODE });
    expect(await second.findActive({ now })).toBeNull();
    expect(await sendFrom({ accountId: SECOND_ACCOUNT, text: 'dois' })).toEqual({ delivered: true });
  });
});
