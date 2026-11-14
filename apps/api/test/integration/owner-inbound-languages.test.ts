import { COMMAND_WORDS, renderAccountReply, type AccountReply } from '@zapbip/core';
import { AccountReplyIntent, CommandKind, OwnerLocale, ReplyKind } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigrationWithNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { bindingsWith, deliver, findAccounts, screenTextsOf } from './owner-inbound-fixtures';

const OWNERS: [OwnerLocale, string][] = [
  [OwnerLocale.PortugueseBrazil, '5511900000000'],
  [OwnerLocale.EnglishUs, '14155550123'],
  [OwnerLocale.Spanish, '34612345678'],
  [OwnerLocale.German, '4915112345678'],
  [OwnerLocale.French, '33612345678'],
  [OwnerLocale.Japanese, '819012345678'],
  [OwnerLocale.Korean, '821012345678'],
  [OwnerLocale.ChineseSimplified, '8613812345678'],
];
const HONG_KONG_WA_ID = '85291234567';
const SECOND_AGENT = 'helper';

function wordsOf(input: { kind: CommandKind; locale: OwnerLocale }): string {
  return COMMAND_WORDS.find((entry) => entry.kind === input.kind && entry.locale === input.locale)!.words;
}

async function storedLocale(input: { waId: string }): Promise<string> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT locale FROM owner_identities WHERE wa_id = ?')
    .bind(input.waId)
    .first<{ locale: string }>();
  if (row === null) throw new Error('identity missing');
  return row.locale;
}

async function screenOf(input: { waId: string }): Promise<string> {
  const [account] = await findAccounts({ waId: input.waId });
  return (await screenTextsOf({ accountId: account!.accountId })).join('\n');
}

beforeEach(applyDirectoryMigrationWithNumber);
afterEach(reset);

describe('an owner of each language through the inbound handler', () => {
  const bindings = (): ReturnType<typeof bindingsWith> => bindingsWith({ waitlistEnabled: false });

  it.each(OWNERS)('stores %s for a phone of that country at the first message', async (locale, waId) => {
    await deliver({ bindings: bindings(), text: 'ok', waId });
    expect(await storedLocale({ waId })).toBe(locale);
  });

  it.each(OWNERS)('answers help in %s with the menu text of that language', async (locale, waId) => {
    await deliver({ bindings: bindings(), text: wordsOf({ kind: CommandKind.Help, locale }), waId });
    const screen = await screenOf({ waId });
    const menu: AccountReply = { intent: AccountReplyIntent.Menu, kind: ReplyKind.List, locale, parameters: {}, menuRows: [] };
    expect(screen).toContain(renderAccountReply({ reply: menu }));
  });

  it.each(OWNERS)('creates an agent with the new agent words of %s and names its own rotate word', async (locale, waId) => {
    await deliver({ bindings: bindings(), text: `${wordsOf({ kind: CommandKind.CreateAgent, locale })} ${SECOND_AGENT}`, waId });
    const screen = await screenOf({ waId });
    expect(screen).toContain(`${wordsOf({ kind: CommandKind.RotateAgent, locale })} ${SECOND_AGENT}`);
    expect(screen).toContain('/i/zb_inst_');
  });

  it.each(OWNERS)('asks %s owners to confirm the deletion with their own phrase', async (locale, waId) => {
    await deliver({ bindings: bindings(), text: wordsOf({ kind: CommandKind.RequestDeletion, locale }), waId });
    expect(await screenOf({ waId })).toContain(wordsOf({ kind: CommandKind.ConfirmDeletion, locale }));
  });

  it('keeps the English and Portuguese words working for a Japanese owner and answers in the language of the word', async () => {
    const waId = '819012345678';
    await deliver({ bindings: bindings(), text: 'new agent helper', waId });
    expect(await screenOf({ waId })).toContain('rotate helper');
    await deliver({ bindings: bindings(), text: 'novo agente outro', waId });
    expect(await screenOf({ waId })).toContain('girar outro');
  });

  it('changes the language with the language command and answers the next message in it', async () => {
    const waId = '14155550123';
    await deliver({ bindings: bindings(), text: 'language ja', waId });
    expect(await storedLocale({ waId })).toBe(OwnerLocale.Japanese);
    await deliver({ bindings: bindings(), text: wordsOf({ kind: CommandKind.Help, locale: OwnerLocale.EnglishUs }), waId });
    expect(await screenOf({ waId })).toContain('何をしますか');
  });

  it('keeps the stored language for an unknown code', async () => {
    const waId = '4915112345678';
    await deliver({ bindings: bindings(), text: 'sprache klingon', waId });
    expect(await storedLocale({ waId })).toBe(OwnerLocale.German);
    expect(await screenOf({ waId })).toContain('ko, zh');
  });

  it('answers a phone of Hong Kong in English, the documented fallback', async () => {
    await deliver({ bindings: bindings(), text: 'ok', waId: HONG_KONG_WA_ID });
    expect(await storedLocale({ waId: HONG_KONG_WA_ID })).toBe(OwnerLocale.EnglishUs);
  });
});
