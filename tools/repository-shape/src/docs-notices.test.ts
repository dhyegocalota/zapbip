import { INBOX_COPY, WAKE_COPY } from '@zapbip/core';
import { InboxCopyKey, OwnerLocale, WakeCopyKey } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, documentFiles, readRepositoryFile } from './repository-files';

const NOTICE_BUBBLE_PATTERN = /notice: true, text: '((?:[^'\\]|\\.)*)'/g;
const ESCAPED_COPY_TOKEN_PATTERN = /\\\{\w+\\\}/g;
const TOKEN_MATCHER = '.+';
const PORTUGUESE_PAGE_PREFIX = 'pt-br/';
const NOTICE_COPY_KEYS: InboxCopyKey[] = [InboxCopyKey.NoticeBody, InboxCopyKey.QuestionNoticeBody, InboxCopyKey.AgentNotListening];
const WAKE_NOTICE_COPY_KEYS: WakeCopyKey[] = [WakeCopyKey.ExpectedDelayNote, WakeCopyKey.StaleNotice];
const REGEX_SPECIAL_PATTERN = /[.*+?^${}()|[\]\\]/g;

type NoticeBubble = { page: string; locale: OwnerLocale; text: string };

function localeOf(page: string): OwnerLocale {
  return page.startsWith(PORTUGUESE_PAGE_PREFIX) ? OwnerLocale.PortugueseBrazil : OwnerLocale.EnglishUs;
}

function templateMatcher(template: string): RegExp {
  const escaped = template.replace(REGEX_SPECIAL_PATTERN, '\\$&');
  return new RegExp(`^${escaped.replace(ESCAPED_COPY_TOKEN_PATTERN, TOKEN_MATCHER)}$`);
}

function noticeBubbles(): NoticeBubble[] {
  return documentFiles('').flatMap((page) =>
    [...readRepositoryFile(`${DOCS_ROOT}/${page}`).matchAll(NOTICE_BUBBLE_PATTERN)].map(([, text]) => ({
      page,
      locale: localeOf(page),
      text: text!,
    })),
  );
}

function matchesRealTemplate(bubble: NoticeBubble): boolean {
  const templates = [
    ...NOTICE_COPY_KEYS.map((key) => INBOX_COPY[key][bubble.locale]),
    ...WAKE_NOTICE_COPY_KEYS.map((key) => WAKE_COPY[key][bubble.locale]),
  ];
  return templates.some((template) => templateMatcher(template).test(bubble.text));
}

describe('docs notices', () => {
  const bubbles = noticeBubbles();

  test('there are notice bubbles in both languages', () => {
    expect(bubbles.map((bubble) => bubble.locale)).toContain(OwnerLocale.EnglishUs);
    expect(bubbles.map((bubble) => bubble.locale)).toContain(OwnerLocale.PortugueseBrazil);
  });

  test.each(bubbles.map((bubble) => [bubble.page, bubble.text, bubble] as const))(
    '%s notice "%s" quotes the real copy',
    (_page, _text, bubble) => {
      expect(matchesRealTemplate(bubble)).toBe(true);
    },
  );
});
