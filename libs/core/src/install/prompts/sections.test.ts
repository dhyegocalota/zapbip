import {
  CHATGPT_POLL_INTERVAL_MINUTES,
  HEARTBEAT_POLL_INTERVAL_MINUTES,
  INSTALL_SELF_TEST_TEXT,
  InstallClient,
  OwnerLocale,
} from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INSTALL_PAGE_COPY } from '../install-page-copy';
import { CLIENTS, CONNECTION_LINK, LOCALES, lastNonEmptyLine, sectionInput } from '../testing/fixtures';
import { CHATGPT_COPY } from './chatgpt-copy';
import { CLAUDE_AI_COPY } from './claude-ai-copy';
import { CLAUDE_CODE_COPY, CLAUDE_CODE_SKILL_DESCRIPTION } from './claude-code-copy';
import { CODEX_COPY } from './codex-copy';
import { CURSOR_COPY } from './cursor-copy';
import { GEMINI_CLI_COPY } from './gemini-cli-copy';
import { GROK_BOT_COPY } from './grok-bot-copy';
import { GROK_WEB_COPY } from './grok-web-copy';
import { HERMES_COPY } from './hermes-copy';
import { INSTALL_SECTIONS } from './index';
import { OPENCLAW_COPY } from './openclaw-copy';

const SET_WAKE_MODE_PATTERN = /set_wake\(\{mode: "(\w+)"/g;
const STOP_CHECK_PATTERN = /^1\. If you are not .+, stop and run no other step of this section\.$/m;
const SECRET_FRAGMENT = 'zb_conn_FAKE';

const ALLOWED_WAKE_MODES: Record<InstallClient, string[]> = {
  [InstallClient.ClaudeCode]: ['local'],
  [InstallClient.Codex]: ['local'],
  [InstallClient.Cursor]: ['local'],
  [InstallClient.GeminiCli]: ['local'],
  [InstallClient.GrokBot]: ['webhook'],
  [InstallClient.ClaudeAi]: ['webhook', 'none'],
  [InstallClient.ChatGpt]: ['scheduled'],
  [InstallClient.GrokWeb]: ['none', 'standby'],
  [InstallClient.Hermes]: ['local', 'scheduled'],
  [InstallClient.OpenClaw]: ['local', 'scheduled'],
};

function wakeModesOf(text: string): string[] {
  return [...new Set([...text.matchAll(SET_WAKE_MODE_PATTERN)].map((match) => match[1] as string))];
}

describe('install sections', () => {
  test('pin: the dispatch record covers every client', () => {
    expect(Object.keys(INSTALL_SECTIONS).sort()).toEqual([...CLIENTS].sort());
    expect(Object.keys(INSTALL_SECTIONS)).toHaveLength(10);
  });

  test('pin: every copy record covers every locale', () => {
    const copyRecords = [
      INSTALL_PAGE_COPY,
      CLAUDE_CODE_COPY,
      CLAUDE_CODE_SKILL_DESCRIPTION,
      CODEX_COPY,
      GROK_BOT_COPY,
      CLAUDE_AI_COPY,
      CHATGPT_COPY,
      GROK_WEB_COPY,
      HERMES_COPY,
      OPENCLAW_COPY,
      CURSOR_COPY,
      GEMINI_CLI_COPY,
    ];
    copyRecords.forEach((record) => expect(Object.keys(record).sort()).toEqual([...LOCALES].sort()));
  });

  describe.each(CLIENTS.flatMap((client) => LOCALES.map((locale) => ({ client, locale }))))('$client in $locale', ({ client, locale }) => {
    const text = INSTALL_SECTIONS[client](sectionInput({ locale }));

    test('ends with the localized self-test', () => {
      expect(lastNonEmptyLine(text)).toContain(INSTALL_SELF_TEST_TEXT[locale]);
    });

    test('opens with the stop check', () => {
      expect(text).toMatch(STOP_CHECK_PATTERN);
    });

    test('sets only the wake modes of its own product', () => {
      const allowed = ALLOWED_WAKE_MODES[client];
      expect(wakeModesOf(text).every((mode) => allowed.includes(mode))).toBe(true);
      expect(wakeModesOf(text).length).toBeGreaterThan(0);
    });

    test('writes the connection secret only inside the connection link', () => {
      expect(text).toContain(CONNECTION_LINK);
      expect(text.replaceAll(CONNECTION_LINK, '')).not.toContain(SECRET_FRAGMENT);
    });

    test('renders the same text twice', () => {
      expect(INSTALL_SECTIONS[client](sectionInput({ locale }))).toBe(text);
    });
  });

  test('ChatGPT and the heartbeat clients use the shared poll intervals', () => {
    const chatGpt = INSTALL_SECTIONS[InstallClient.ChatGpt](sectionInput({ locale: OwnerLocale.EnglishUs }));
    const hermes = INSTALL_SECTIONS[InstallClient.Hermes](sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(chatGpt).toContain(`set_wake({mode: "scheduled", interval_minutes: ${CHATGPT_POLL_INTERVAL_MINUTES}})`);
    expect(hermes).toContain(`set_wake({mode: "scheduled", interval_minutes: ${HEARTBEAT_POLL_INTERVAL_MINUTES}})`);
  });
});
