import { AccountReplyIntent, AccountReplyParameter, CommandKind, OwnerLocale, ReplyKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { LIST_ROW_TITLE_MAX_CHARS, WHATSAPP_TEXT_MAX_CHARS } from '../inbox/constants';
import type { AccountReply } from './account-types';
import { buildMenuButtonText, buildMenuRows, renderAccountReply } from './account-copy';
import { LIST_BUTTON_TEXT_MAX_CHARS } from './constants';

const LOCALES = Object.values(OwnerLocale);
const INTENTS = Object.values(AccountReplyIntent);
const PARAMETER_VALUES: Record<AccountReplyParameter, string> = {
  [AccountReplyParameter.AgentName]: 'a'.repeat(20),
  [AccountReplyParameter.Limit]: '8',
  [AccountReplyParameter.Usage]: 'novo agente <nome>',
  [AccountReplyParameter.Phrase]: 'apagar conta definitivamente',
  [AccountReplyParameter.Agents]: '- claude (2026-11-06)',
  [AccountReplyParameter.InstallPrompt]: 'install prompt',
};

function buildReply(input: { intent: AccountReplyIntent; locale: OwnerLocale }): AccountReply {
  return {
    intent: input.intent,
    kind: input.intent === AccountReplyIntent.Menu ? ReplyKind.List : ReplyKind.Text,
    locale: input.locale,
    parameters: PARAMETER_VALUES,
    menuRows: input.intent === AccountReplyIntent.Menu ? buildMenuRows({ locale: input.locale }) : [],
  };
}

describe('renderAccountReply', () => {
  test.each(LOCALES.flatMap((locale) => INTENTS.map((intent) => [locale, intent] as const)))('%s renders %s', (locale, intent) => {
    expect(renderAccountReply({ reply: buildReply({ intent, locale }) }).length).toBeGreaterThan(0);
  });

  test('puts the usage line in the text', () => {
    const reply = {
      ...buildReply({ intent: AccountReplyIntent.Usage, locale: OwnerLocale.PortugueseBrazil }),
      parameters: { [AccountReplyParameter.Usage]: 'novo agente <nome>' },
    };
    expect(renderAccountReply({ reply })).toContain('novo agente <nome>');
  });

  test('throws naming the missing install prompt', () => {
    const reply = {
      ...buildReply({ intent: AccountReplyIntent.Created, locale: OwnerLocale.EnglishUs }),
      parameters: { [AccountReplyParameter.AgentName]: 'claude' },
    };
    expect(() => renderAccountReply({ reply })).toThrow(AccountReplyParameter.InstallPrompt);
  });

  test('keeps every text within the WhatsApp text limit', () => {
    const lengths = LOCALES.flatMap((locale) =>
      INTENTS.map((intent) => renderAccountReply({ reply: buildReply({ intent, locale }) }).length),
    );
    expect(lengths.every((length) => length <= WHATSAPP_TEXT_MAX_CHARS)).toBe(true);
  });
});

describe('buildMenuRows', () => {
  test.each(LOCALES)('lists the six menu commands in order in %s', (locale) => {
    expect(buildMenuRows({ locale }).map((row) => row.id)).toEqual([
      'zapbip:create_agent',
      'zapbip:list_agents',
      'zapbip:revoke_agent',
      'zapbip:rotate_agent',
      'zapbip:help',
      'zapbip:request_deletion',
    ]);
  });

  test.each(LOCALES)('keeps every row title within the list row limit in %s', (locale) => {
    expect(buildMenuRows({ locale }).every((row) => row.title.length > 0 && row.title.length <= LIST_ROW_TITLE_MAX_CHARS)).toBe(true);
  });

  test.each(LOCALES)('keeps the list button text within its limit in %s', (locale) => {
    const buttonText = buildMenuButtonText({ locale });
    expect(buttonText.length).toBeGreaterThan(0);
    expect(buttonText.length).toBeLessThanOrEqual(LIST_BUTTON_TEXT_MAX_CHARS);
  });

  test('never offers the confirmation as a row', () => {
    expect(buildMenuRows({ locale: OwnerLocale.EnglishUs }).map((row) => row.id)).not.toContain(`zapbip:${CommandKind.ConfirmDeletion}`);
  });
});
