import { AccountReplyIntent, AccountReplyParameter, COMPANY, CommandKind, OwnerLocale, ReplyKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { LIST_ROW_TITLE_MAX_CHARS, WHATSAPP_TEXT_MAX_CHARS } from '../inbox/constants';
import type { AccountReply } from './account-types';
import { buildUsageReply } from './use-cases/usage-reply';
import { COMMAND_WORDS } from './command-words';
import { buildMenuButtonText, buildMenuRows, renderAccountReply, renderInstallLines } from './account-copy';
import { LIST_BUTTON_TEXT_MAX_CHARS } from './constants';
import { ownerLanguageOfValue } from './owner-locale';

const LOCALES = Object.values(OwnerLocale);
const INTENTS = Object.values(AccountReplyIntent);
const PARAMETER_VALUES: Record<AccountReplyParameter, string> = {
  [AccountReplyParameter.AgentName]: 'a'.repeat(20),
  [AccountReplyParameter.Limit]: '8',
  [AccountReplyParameter.Usage]: 'novo agente <nome>',
  [AccountReplyParameter.Phrase]: 'apagar conta definitivamente',
  [AccountReplyParameter.Agents]: '- claude (2026-11-06)',
  [AccountReplyParameter.InstallPrompt]: 'install prompt',
  [AccountReplyParameter.SignInLink]: 'https://app.zapbip.test/sign-in/token',
  [AccountReplyParameter.AppLink]: 'https://app.zapbip.test',
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

  test('[row 111] throws naming the missing install prompt', () => {
    const reply = {
      ...buildReply({ intent: AccountReplyIntent.Created, locale: OwnerLocale.EnglishUs }),
      parameters: { [AccountReplyParameter.AgentName]: 'claude' },
    };
    expect(() => renderAccountReply({ reply })).toThrow(AccountReplyParameter.InstallPrompt);
  });

  test('[row 113] keeps every text within the WhatsApp text limit', () => {
    const lengths = LOCALES.flatMap((locale) =>
      INTENTS.map((intent) => renderAccountReply({ reply: buildReply({ intent, locale }) }).length),
    );
    expect(lengths.every((length) => length <= WHATSAPP_TEXT_MAX_CHARS)).toBe(true);
  });
});

describe('sign-in link reply', () => {
  test.each(LOCALES)('%s carries the link and says it works once', (locale) => {
    const text = renderAccountReply({ reply: buildReply({ intent: AccountReplyIntent.SignInLink, locale }) });
    expect(text).toContain(PARAMETER_VALUES[AccountReplyParameter.SignInLink]);
  });
});

describe('deletion replies', () => {
  test.each(
    LOCALES.flatMap((locale) =>
      [AccountReplyIntent.DeletionRequest, AccountReplyIntent.DeletionDone].map((intent) => [locale, intent] as const),
    ),
  )('[row 439] %s %s says deleting does not cancel the subscription and names the support address', (locale, intent) => {
    expect(renderAccountReply({ reply: buildReply({ intent, locale }) })).toContain(COMPANY.contactEmail);
  });
});

const LANGUAGE_CODES = ['en', 'pt', 'es', 'de', 'fr', 'ja', 'ko', 'zh', 'ar', 'hi'];

describe('the unknown language reply', () => {
  test('names only codes the language command accepts', () => {
    expect(LANGUAGE_CODES.filter((value) => ownerLanguageOfValue({ value }) === null)).toEqual([]);
  });

  test.each(LOCALES)('lists every language code in %s', (locale) => {
    const text = renderAccountReply({ reply: buildReply({ intent: AccountReplyIntent.LanguageUnknown, locale }) });
    expect(LANGUAGE_CODES.filter((code) => !text.includes(code))).toEqual([]);
  });
});

describe('usage replies', () => {
  test.each(LOCALES)('[row 116] every usage text stays within the WhatsApp text limit in %s', (locale) => {
    const lengths = COMMAND_WORDS.map((entry) => renderAccountReply({ reply: buildUsageReply({ kind: entry.kind, locale }) }).length);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(WHATSAPP_TEXT_MAX_CHARS);
  });
});

const INSTALL_LINK = 'https://zapbip.test/i/zb_inst_example';
const LINE_BREAK = '\n';
const CONNECTION_SECRET_MARK = 'zb_conn_';

describe('renderInstallLines', () => {
  test.each(LOCALES)('is exactly two lines with the link in the first, in %s', (locale) => {
    const [firstLine, secondLine, ...rest] = renderInstallLines({ installLink: INSTALL_LINK, locale }).split(LINE_BREAK);
    expect(rest).toEqual([]);
    expect(firstLine).toContain(INSTALL_LINK);
    expect(secondLine).not.toContain(INSTALL_LINK);
  });

  test.each(LOCALES)('keeps each line within the WhatsApp text limit and never names a connection secret in %s', (locale) => {
    const lines = renderInstallLines({ installLink: INSTALL_LINK, locale }).split(LINE_BREAK);
    expect(lines.every((line) => line.length <= WHATSAPP_TEXT_MAX_CHARS)).toBe(true);
    expect(lines.join(LINE_BREAK)).not.toContain(CONNECTION_SECRET_MARK);
  });

  test.each(LOCALES)('says the link works once for thirty minutes in %s', (locale) => {
    expect(renderInstallLines({ installLink: INSTALL_LINK, locale })).toContain('30');
  });

  test.each(
    LOCALES.flatMap((locale) => [AccountReplyIntent.Created, AccountReplyIntent.Rotated].map((intent) => [locale, intent] as const)),
  )('%s %s carries the two lines, the rotate hint and no connection secret', (locale, intent) => {
    const installLines = renderInstallLines({ installLink: INSTALL_LINK, locale });
    const reply = {
      ...buildReply({ intent, locale }),
      parameters: { [AccountReplyParameter.AgentName]: 'claude', [AccountReplyParameter.InstallPrompt]: installLines },
    };
    const text = renderAccountReply({ reply });
    expect(text).toContain(installLines);
    expect(text).toContain('claude');
    expect(text).not.toContain(CONNECTION_SECRET_MARK);
  });
});

describe('buildMenuRows', () => {
  test.each(LOCALES)('lists the seven menu commands in order in %s', (locale) => {
    expect(buildMenuRows({ locale }).map((row) => row.id)).toEqual([
      'zapbip:create_agent',
      'zapbip:list_agents',
      'zapbip:revoke_agent',
      'zapbip:rotate_agent',
      'zapbip:help',
      'zapbip:set_language',
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

describe('company line', () => {
  const WITH_COMPANY_LINE = [AccountReplyIntent.Waitlisted, AccountReplyIntent.Unknown, AccountReplyIntent.Menu];
  const WITHOUT_COMPANY_LINE = [AccountReplyIntent.EmptyList, AccountReplyIntent.DeletionDone, AccountReplyIntent.Suspended];

  function render(input: { intent: AccountReplyIntent; locale: OwnerLocale }): string {
    return renderAccountReply({ reply: { ...input, kind: ReplyKind.Text, parameters: {}, menuRows: [] } });
  }

  test.each(WITH_COMPANY_LINE)('[row 487] ends the %s reply with the company line in both locales', (intent) => {
    expect(render({ intent, locale: OwnerLocale.PortugueseBrazil }).endsWith('zapbip é um produto da Logic Bit')).toBe(true);
    expect(render({ intent, locale: OwnerLocale.EnglishUs }).endsWith('zapbip is a product of Logic Bit')).toBe(true);
  });

  test.each(WITHOUT_COMPANY_LINE)('leaves the %s reply without it', (intent) => {
    expect(render({ intent, locale: OwnerLocale.EnglishUs })).not.toContain('Logic Bit');
  });

  test('never prints a company fact sentinel', () => {
    expect(render({ intent: AccountReplyIntent.Menu, locale: OwnerLocale.EnglishUs })).not.toContain('UNSET');
  });
});
