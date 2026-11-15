import { reset } from 'cloudflare:test';
import { AccountState, OwnerLocale, WHATSAPP_LINK_ORIGIN } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import { D1AccountDirectory } from '../../src/adapters/d1/d1-account-directory';
import { receiveOwnerInbound } from '../../src/inbound/owner-inbound';
import { recordGraphPosts } from '../support/record-graph-posts';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { seedWhatsAppNumber, TEST_DISPLAY_NUMBER, TEST_NUMBER_ID, TEST_REGISTERED_NUMBER } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { bindingsWith, countAccounts, deliver, findAccounts, nextWamid, screenTextsOf, textEntry } from './owner-inbound-fixtures';

const NEW_PHONE = '5511900000201';
const ACTIVE_PHONE = '5511900000202';
const SUSPENDED_PHONE = '5511900000203';
const ENGLISH_PHONE = '14155550201';
const SETUP_LINK_FRAGMENT = 'get-started/how-to-start';
const SECOND_NUMBER = {
  numberId: 'num_0201',
  phoneNumberId: '1000000000201',
  wabaId: '3000000000201',
  accessToken: 'token-0201',
  displayNumber: '+5511977770201',
};

async function onboardingTextsOf(input: { waId: string }): Promise<string[]> {
  const [account] = await findAccounts({ waId: input.waId });
  if (account === undefined) throw new Error('account is missing');
  const texts = await screenTextsOf({ accountId: account.accountId });
  return texts.filter((text) => text.includes(SETUP_LINK_FRAGMENT));
}

async function noticeRowsOf(input: { accountId: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM other_number_notices WHERE account_id = ?')
    .bind(input.accountId)
    .first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

function deliverOnSecondNumber(input: { waId: string }) {
  return receiveOwnerInbound({
    number: { ...TEST_REGISTERED_NUMBER, numberId: SECOND_NUMBER.numberId, phoneNumberId: SECOND_NUMBER.phoneNumberId },
    bindings: bindingsWith({ waitlistEnabled: true }),
    waId: input.waId,
    writtenText: null,
    channelMessageId: nextWamid(),
    entryOf: async () => textEntry({ text: 'oi' }),
  });
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedWhatsAppNumber();
  await seedWhatsAppNumber(SECOND_NUMBER);
});

afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('a phone that is not a customer', () => {
  it('gets one onboarding reply with the setup and access links and joins the waitlist once', async () => {
    const bindings = bindingsWith({ waitlistEnabled: true });
    await deliver({ bindings, text: 'oi', waId: NEW_PHONE });
    await deliver({ bindings, text: 'tem alguém aí?', waId: NEW_PHONE });
    const accounts = await findAccounts({ waId: NEW_PHONE });
    expect(accounts.map((account) => account.state)).toEqual([AccountState.Waitlisted]);
    expect(await countAccounts()).toBe(1);
    const onboarding = await onboardingTextsOf({ waId: NEW_PHONE });
    expect(onboarding).toHaveLength(1);
    expect(onboarding[0]).toContain('https://docs.zapbip.com/pt-br/get-started/how-to-start');
    expect(onboarding[0]).toContain('https://zapbip.com/pt-br');
  });

  it('writes in English to a phone outside Brazil', async () => {
    await deliver({ bindings: bindingsWith({ waitlistEnabled: true }), text: 'hi', waId: ENGLISH_PHONE });
    const [onboarding] = await onboardingTextsOf({ waId: ENGLISH_PHONE });
    expect(onboarding).toContain('https://docs.zapbip.com/get-started/how-to-start');
    expect(onboarding).not.toContain('/pt-br');
  });

  it('still answers a command inside the cooldown', async () => {
    const bindings = bindingsWith({ waitlistEnabled: true });
    await deliver({ bindings, text: 'oi', waId: NEW_PHONE });
    await deliver({ bindings, text: 'ajuda', waId: NEW_PHONE });
    const [account] = await findAccounts({ waId: NEW_PHONE });
    const texts = await screenTextsOf({ accountId: account!.accountId });
    expect(texts.length).toBeGreaterThan(1);
  });
});

describe('a customer on the number its agents use', () => {
  it('gets no onboarding reply', async () => {
    await seedOwnerIdentity({
      accountId: 'acc_right',
      phone: ACTIVE_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    await deliver({ bindings: bindingsWith({ waitlistEnabled: true }), text: 'oi', waId: ACTIVE_PHONE });
    expect(await onboardingTextsOf({ waId: ACTIVE_PHONE })).toEqual([]);
  });
});

describe('a customer writing to a different zapbip number', () => {
  it('is told once where its chat is, with the link, and nothing is created or routed', async () => {
    const posts = recordGraphPosts();
    await seedOwnerIdentity({
      accountId: 'acc_wrong',
      phone: ACTIVE_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    const accountsBefore = await countAccounts();
    await deliverOnSecondNumber({ waId: ACTIVE_PHONE });
    await deliverOnSecondNumber({ waId: ACTIVE_PHONE });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toContain(`/${SECOND_NUMBER.phoneNumberId}/messages`);
    expect(posts[0]?.body.to).toBe(ACTIVE_PHONE);
    expect(posts[0]?.body.text.body).toContain(`${WHATSAPP_LINK_ORIGIN}/${TEST_DISPLAY_NUMBER}`);
    expect(await countAccounts()).toBe(accountsBefore);
    expect(await screenTextsOf({ accountId: 'acc_wrong' })).toEqual([]);
  });

  it('leaves no notice row behind when the account is deleted', async () => {
    recordGraphPosts();
    await seedOwnerIdentity({
      accountId: 'acc_deleted',
      phone: ACTIVE_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    await deliverOnSecondNumber({ waId: ACTIVE_PHONE });
    expect(await noticeRowsOf({ accountId: 'acc_deleted' })).toBe(1);
    await new D1AccountDirectory({ database: testEnv.CONNECTIONS }).remove({ accountId: 'acc_deleted' });
    expect(await noticeRowsOf({ accountId: 'acc_deleted' })).toBe(0);
  });

  it('is told again after the cooldown', async () => {
    const posts = recordGraphPosts();
    await seedOwnerIdentity({
      accountId: 'acc_again',
      phone: ACTIVE_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    await deliverOnSecondNumber({ waId: ACTIVE_PHONE });
    await testEnv.CONNECTIONS.prepare('UPDATE other_number_notices SET noticed_at = 0').run();
    await deliverOnSecondNumber({ waId: ACTIVE_PHONE });
    expect(posts).toHaveLength(2);
  });

  it('speaks the language of the account', async () => {
    const posts = recordGraphPosts();
    await seedOwnerIdentity({
      accountId: 'acc_english',
      phone: ENGLISH_PHONE,
      ownerLocale: OwnerLocale.EnglishUs,
      numberId: TEST_NUMBER_ID,
    });
    await deliverOnSecondNumber({ waId: ENGLISH_PHONE });
    const template = WHATSAPP_COPY[OwnerLocale.EnglishUs][OwnerCopyKey.AccountOnOtherNumber];
    expect(posts[0]?.body.text.body).toBe(
      template.replace('{displayNumber}', TEST_DISPLAY_NUMBER).replace('{whatsAppLink}', `${WHATSAPP_LINK_ORIGIN}/${TEST_DISPLAY_NUMBER}`),
    );
  });
});

describe('a suspended customer', () => {
  it('gets the suspended reply every time and no onboarding reply', async () => {
    await seedOwnerIdentity({
      accountId: 'acc_suspended',
      phone: SUSPENDED_PHONE,
      ownerLocale: OwnerLocale.PortugueseBrazil,
      numberId: TEST_NUMBER_ID,
    });
    await testEnv.CONNECTIONS.prepare("UPDATE accounts SET state = 'suspended' WHERE id = ?").bind('acc_suspended').run();
    const bindings = bindingsWith({ waitlistEnabled: true });
    await deliver({ bindings, text: 'oi', waId: SUSPENDED_PHONE });
    await deliver({ bindings, text: 'oi de novo', waId: SUSPENDED_PHONE });
    expect(await screenTextsOf({ accountId: 'acc_suspended' })).toHaveLength(2);
    expect(await onboardingTextsOf({ waId: SUSPENDED_PHONE })).toEqual([]);
  });
});
