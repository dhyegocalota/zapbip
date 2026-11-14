import { AccountReplyIntent, CommandKind, InboxCopyKey, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { ApprovalChoice, approvalTitlesOf, renderApprovalQuestion } from './accounts/agent-approval-copy';
import { COMPANY_LINE, UNKNOWN_CLIENT_LABEL, buildMenuButtonText, buildMenuRows, renderAccountReply } from './accounts/account-copy';
import { COMMAND_WORDS } from './accounts/command-words';
import type { AccountReply } from './accounts/account-types';
import { INBOX_COPY } from './inbox/inbox-copy';
import { INSTALL_PAGE_COPY } from './install/install-page-copy';
import { WAKE_COPY } from './wake/wake-copy';
import { LIST_BUTTON_TEXT_MAX_CHARS } from './accounts/constants';
import { BUTTON_TITLE_MAX_CHARS, LIST_ROW_TITLE_MAX_CHARS } from './inbox/constants';

const LOCALES = Object.values(OwnerLocale);
const NON_ENGLISH = LOCALES.filter((locale) => locale !== OwnerLocale.EnglishUs);
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const COGNATES = new Set([
  `${InboxCopyKey.PreviewAudio}:${OwnerLocale.Spanish}`,
  `${InboxCopyKey.PreviewAudio}:${OwnerLocale.German}`,
  `${InboxCopyKey.PreviewAudio}:${OwnerLocale.French}`,
  `${InboxCopyKey.PreviewAudio}:${OwnerLocale.PortugueseBrazil}`,
  `${InboxCopyKey.PreviewVideo}:${OwnerLocale.German}`,
  `${InboxCopyKey.PreviewSticker}:${OwnerLocale.Spanish}`,
  `${InboxCopyKey.PreviewSticker}:${OwnerLocale.German}`,
  `${InboxCopyKey.PreviewSticker}:${OwnerLocale.French}`,
  `${InboxCopyKey.PreviewImage}:${OwnerLocale.French}`,
  `${InboxCopyKey.PreviewDocument}:${OwnerLocale.French}`,
  `${InboxCopyKey.PreviewContacts}:${OwnerLocale.French}`,
  `${InboxCopyKey.PreviewLocation}:${OwnerLocale.German}`,
]);

function placeholdersOf(text: string): string {
  return [...text.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1]!)
    .sort()
    .join();
}

function wordsOf(input: { kind: CommandKind; locale: OwnerLocale }): string {
  return COMMAND_WORDS.find((entry) => entry.kind === input.kind && entry.locale === input.locale)!.words;
}

const REPLY_PARAMETERS = ['agent_name', 'limit', 'usage', 'phrase', 'agents', 'install_prompt', 'sign_in_link', 'app_link'];
const MARKER_PATTERN = /⟦(\w+)⟧/g;

function markersOf(input: { intent: AccountReplyIntent; locale: OwnerLocale }): string {
  const parameters = Object.fromEntries(REPLY_PARAMETERS.map((name) => [name, `⟦${name}⟧`]));
  const reply = { intent: input.intent, kind: 'text', locale: input.locale, parameters, menuRows: [] } as unknown as AccountReply;
  return [...renderAccountReply({ reply }).matchAll(MARKER_PATTERN)]
    .map((match) => match[1]!)
    .sort()
    .join();
}

function replyOf(input: { intent: AccountReplyIntent; locale: OwnerLocale }): string {
  const parameters = {
    agent_name: 'helper',
    limit: '8',
    usage: 'x',
    phrase: 'x',
    agents: 'x',
    install_prompt: 'x',
    sign_in_link: 'x',
    app_link: 'x',
  };
  const reply = { intent: input.intent, kind: 'text', locale: input.locale, parameters, menuRows: [] } as unknown as AccountReply;
  return renderAccountReply({ reply });
}

describe('the inbox copy in eight languages', () => {
  it.each(Object.values(InboxCopyKey))('%s keeps the same placeholders in every language', (key) => {
    const english = placeholdersOf(INBOX_COPY[key][OwnerLocale.EnglishUs]);
    expect(NON_ENGLISH.filter((locale) => placeholdersOf(INBOX_COPY[key][locale]) !== english)).toEqual([]);
  });

  it('words every text differently from English, except a few cognate previews', () => {
    const same = Object.values(InboxCopyKey).flatMap((key) =>
      NON_ENGLISH.filter(
        (locale) => INBOX_COPY[key][locale] === INBOX_COPY[key][OwnerLocale.EnglishUs] && !COGNATES.has(`${key}:${locale}`),
      ).map((locale) => `${key}:${locale}`),
    );
    expect(same).toEqual([]);
  });

  it.each(LOCALES)('keeps the quick reply of %s within the WhatsApp limit', (locale) => {
    expect([...INBOX_COPY[InboxCopyKey.NoticeQuickReply][locale]].length).toBeLessThanOrEqual(BUTTON_TITLE_MAX_CHARS);
  });
});

describe('the wake copy in eight languages', () => {
  it.each(Object.values(WakeCopyKey))('%s keeps the same placeholders in every language', (key) => {
    const english = placeholdersOf(WAKE_COPY[key][OwnerLocale.EnglishUs]);
    expect(NON_ENGLISH.filter((locale) => placeholdersOf(WAKE_COPY[key][locale]) !== english)).toEqual([]);
  });

  it.each(LOCALES)('names set_wake in the failure text of %s', (locale) => {
    expect(WAKE_COPY[WakeCopyKey.WakeFailed][locale]).toContain('set_wake');
  });
});

describe('the account replies in eight languages', () => {
  it.each(Object.values(AccountReplyIntent))('%s keeps the same placeholders in every language', (intent) => {
    const english = markersOf({ intent, locale: OwnerLocale.EnglishUs });
    expect(NON_ENGLISH.filter((locale) => markersOf({ intent, locale }) !== english)).toEqual([]);
  });

  it.each(LOCALES)('names the commands of its own language in %s', (locale) => {
    const created = replyOf({ intent: AccountReplyIntent.Created, locale });
    expect(created).toContain(`${wordsOf({ kind: CommandKind.RotateAgent, locale })} helper`);
    expect(replyOf({ intent: AccountReplyIntent.Rotated, locale })).toContain(
      `${wordsOf({ kind: CommandKind.RotateAgent, locale })} helper`,
    );
    expect(replyOf({ intent: AccountReplyIntent.LimitReached, locale })).toContain(
      `${wordsOf({ kind: CommandKind.RevokeAgent, locale })} <`,
    );
    expect(replyOf({ intent: AccountReplyIntent.EmptyList, locale })).toContain(`${wordsOf({ kind: CommandKind.CreateAgent, locale })} <`);
    expect(replyOf({ intent: AccountReplyIntent.AccessOpened, locale })).toContain(
      `${wordsOf({ kind: CommandKind.CreateAgent, locale })} <`,
    );
    expect(replyOf({ intent: AccountReplyIntent.Unknown, locale })).toContain(wordsOf({ kind: CommandKind.Help, locale }));
    expect(replyOf({ intent: AccountReplyIntent.Waitlisted, locale })).toContain(wordsOf({ kind: CommandKind.Help, locale }));
    expect(replyOf({ intent: AccountReplyIntent.DeletionExpired, locale })).toContain(
      wordsOf({ kind: CommandKind.RequestDeletion, locale }),
    );
    expect(replyOf({ intent: AccountReplyIntent.LanguageUnknown, locale })).toContain(
      `${wordsOf({ kind: CommandKind.SetLanguage, locale })} <`,
    );
  });

  it.each(LOCALES)('lists every language code in the language help of %s', (locale) => {
    const text = replyOf({ intent: AccountReplyIntent.LanguageUnknown, locale });
    ['en', 'pt', 'es', 'de', 'fr', 'ja', 'ko', 'zh'].forEach((code) => expect(text).toContain(code));
  });

  it.each(LOCALES)('gives %s a company line, a client label, a menu button and seven menu rows within the limits', (locale) => {
    expect(COMPANY_LINE[locale]).toContain('zapbip');
    expect(UNKNOWN_CLIENT_LABEL[locale].length).toBeGreaterThan(0);
    expect([...buildMenuButtonText({ locale })].length).toBeLessThanOrEqual(LIST_BUTTON_TEXT_MAX_CHARS);
    const rows = buildMenuRows({ locale });
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => [...row.title].length <= LIST_ROW_TITLE_MAX_CHARS)).toBe(true);
  });
});

describe('the approval questions in eight languages', () => {
  it.each(LOCALES)('names the requester, the agent and the reference in %s', (locale) => {
    ([CommandKind.CreateAgent, CommandKind.RevokeAgent] as const).forEach((kind) => {
      const text = renderApprovalQuestion({ kind, locale, requester: 'claude', agent: 'helper', reference: 'ab12' });
      expect(text).toContain('claude');
      expect(text).toContain('helper');
      expect(text).toContain('ab12');
    });
  });

  it.each(LOCALES)('quotes the real button titles in the create question in %s, within the button limit', (locale) => {
    const titles = approvalTitlesOf({ locale });
    const text = renderApprovalQuestion({ kind: CommandKind.CreateAgent, locale, requester: 'claude', agent: 'helper', reference: 'ab12' });
    expect(text).toContain(titles[ApprovalChoice.Allow]);
    expect(text).toContain(titles[ApprovalChoice.AllowAndSend]);
    expect(Object.values(titles).every((title) => [...title].length <= BUTTON_TITLE_MAX_CHARS)).toBe(true);
  });
});

describe('the install page copy in eight languages', () => {
  it.each(LOCALES)('names the language the agent speaks to the owner and the rotate command in %s', (locale) => {
    const texts = INSTALL_PAGE_COPY[locale];
    expect(texts.ownerLanguage.length).toBeGreaterThan(0);
    expect(texts.expired).toContain(wordsOf({ kind: CommandKind.RotateAgent, locale }));
    expect(texts.footer).toContain('zapbip');
  });

  it('names a different language for each locale', () => {
    expect(new Set(LOCALES.map((locale) => INSTALL_PAGE_COPY[locale].ownerLanguage)).size).toBe(LOCALES.length);
  });
});
