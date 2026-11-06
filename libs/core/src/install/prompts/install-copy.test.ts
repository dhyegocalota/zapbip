import {
  CHATGPT_POLL_INTERVAL_MINUTES,
  CODEX_TOOL_TIMEOUT_SECONDS,
  HEARTBEAT_POLL_INTERVAL_MINUTES,
  INSTALL_SELF_TEST_TEXT,
  InstallClient,
  OwnerLocale,
} from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CLIENTS, LOCALES, sectionInput } from '../testing/fixtures';
import { INSTALL_SECTIONS } from './index';
import { wakeNoteOf } from './wake-notes';

const INSTALL_SECTION_RESTART_MARK: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Reinicie',
  [OwnerLocale.EnglishUs]: 'Restart',
};

function sectionOf(input: { client: InstallClient; locale: OwnerLocale }): string {
  return INSTALL_SECTIONS[input.client](sectionInput({ locale: input.locale }));
}

describe('install copy', () => {
  test('C1 the Portuguese claude.ai section holds no English trigger wording', () => {
    expect(sectionOf({ client: InstallClient.ClaudeAi, locale: OwnerLocale.PortugueseBrazil })).not.toContain('fire URL and token');
  });

  test.each(LOCALES.flatMap((locale) => [InstallClient.Cursor, InstallClient.GeminiCli].map((client) => ({ client, locale }))))(
    'C2 $client in $locale listens in a background terminal without Monitor',
    ({ client, locale }) => {
      const text = sectionOf({ client, locale });
      expect(text).not.toContain('Monitor');
      expect(text).toContain('background terminal');
      expect(text).toContain('Whenever a new line appears there, call check_inbox');
      expect(text).toContain('no time limit');
    },
  );

  test.each(LOCALES.flatMap((locale) => [InstallClient.Hermes, InstallClient.OpenClaw].map((client) => ({ client, locale }))))(
    'C3 $client in $locale makes the plugin the listener and the every-minute job only the fallback',
    ({ client, locale }) => {
      const text = sectionOf({ client, locale });
      expect(text).toContain('The plugin is the listener, with no time limit');
      expect(text).toContain('Only if the plugin cannot be installed, and never together with it');
      expect(text.match(/Only if the plugin cannot be installed/g)).toHaveLength(1);
    },
  );

  test.each(CLIENTS.flatMap((client) => LOCALES.map((locale) => ({ client, locale }))))(
    'C4 $client in $locale says how the AI is woken, before the self-test',
    ({ client, locale }) => {
      const text = sectionOf({ client, locale });
      const wakeNote = wakeNoteOf({ client, locale, standbyAgent: null });
      expect(text).toContain(wakeNote);
      expect(text.indexOf(wakeNote)).toBeLessThan(text.lastIndexOf('send_message'));
    },
  );

  test.each(LOCALES)('C5 Claude Code in %s runs one listener per connection', (locale) => {
    const text = sectionOf({ client: InstallClient.ClaudeCode, locale });
    expect(text).toContain(
      'A connection holds one listener and a second replaces the first: use exactly one of these, never two together.',
    );
    expect(text.match(/npx zapbip@\S+ connect/g)).toHaveLength(1);
  });

  test('C6 pins the Codex timeout, the ChatGPT interval and the heartbeat interval', () => {
    expect(CODEX_TOOL_TIMEOUT_SECONDS).toBe(900);
    expect(CHATGPT_POLL_INTERVAL_MINUTES).toBe(60);
    expect(HEARTBEAT_POLL_INTERVAL_MINUTES).toBe(1);
    expect(sectionOf({ client: InstallClient.Codex, locale: OwnerLocale.EnglishUs })).toContain(
      `tool_timeout_sec = ${CODEX_TOOL_TIMEOUT_SECONDS}`,
    );
    expect(sectionOf({ client: InstallClient.ChatGpt, locale: OwnerLocale.EnglishUs })).toContain(
      `interval_minutes: ${CHATGPT_POLL_INTERVAL_MINUTES}`,
    );
  });

  test.each(LOCALES)('F3 Grok on the web without a standby says the chat is only read when opened, in %s', (locale) => {
    const withoutStandby = INSTALL_SECTIONS[InstallClient.GrokWeb](sectionInput({ locale, standbyAgent: null }));
    const withStandby = INSTALL_SECTIONS[InstallClient.GrokWeb](sectionInput({ locale, standbyAgent: 'Ana Bot' }));
    expect(withoutStandby).toContain(wakeNoteOf({ client: InstallClient.GrokWeb, locale, standbyAgent: null }));
    expect(withStandby).toContain(wakeNoteOf({ client: InstallClient.GrokWeb, locale, standbyAgent: 'Ana Bot' }));
    expect(wakeNoteOf({ client: InstallClient.GrokWeb, locale, standbyAgent: null })).not.toBe(
      wakeNoteOf({ client: InstallClient.GrokWeb, locale, standbyAgent: 'Ana Bot' }),
    );
    expect(withoutStandby).not.toContain(wakeNoteOf({ client: InstallClient.GrokWeb, locale, standbyAgent: 'Ana Bot' }));
  });

  test('F3 the English no-standby note says to open the chat', () => {
    expect(wakeNoteOf({ client: InstallClient.GrokWeb, locale: OwnerLocale.EnglishUs, standbyAgent: null })).toContain('open the chat');
  });

  test('F10 the Portuguese claude.ai note says at most once every 60 minutes', () => {
    expect(wakeNoteOf({ client: InstallClient.ClaudeAi, locale: OwnerLocale.PortugueseBrazil, standbyAgent: null })).toContain(
      'no máximo uma vez a cada 60 minutos',
    );
  });

  test.each(
    LOCALES.flatMap((locale) =>
      [InstallClient.ClaudeCode, InstallClient.Codex, InstallClient.Cursor, InstallClient.GeminiCli].map((client) => ({ client, locale })),
    ),
  )('F2 $client in $locale reaches the self-test without a wake call before the restart', ({ client, locale }) => {
    const text = sectionOf({ client, locale });
    expect(text).not.toContain('mode: "local"');
    expect(text.lastIndexOf(INSTALL_SELF_TEST_TEXT[locale])).toBeGreaterThan(text.indexOf(INSTALL_SECTION_RESTART_MARK[locale]));
  });
});
