import {
  CHATGPT_POLL_INTERVAL_MINUTES,
  CODEX_TOOL_TIMEOUT_SECONDS,
  HEARTBEAT_POLL_INTERVAL_MINUTES,
  InstallClient,
  OwnerLocale,
} from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CLIENTS, LOCALES, sectionInput } from '../testing/fixtures';
import { INSTALL_SECTIONS } from './index';
import { WAKE_NOTES } from './wake-notes';

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
      expect(text).toContain('whenever a new line appears there, call check_inbox');
      expect(text).toContain('no time limit');
    },
  );

  test.each(LOCALES.flatMap((locale) => [InstallClient.Hermes, InstallClient.OpenClaw].map((client) => ({ client, locale }))))(
    'C3 $client in $locale makes the plugin the listener and the every-minute job only the fallback',
    ({ client, locale }) => {
      const text = sectionOf({ client, locale });
      expect(text).toContain('The plugin is the listener, with no time limit');
      expect(text).toContain('Only if the plugin cannot be installed, and never together with it');
      expect(text.match(/every minute/g)).toHaveLength(1);
    },
  );

  test.each(CLIENTS.flatMap((client) => LOCALES.map((locale) => ({ client, locale }))))(
    'C4 $client in $locale says how the AI is woken, before the self-test',
    ({ client, locale }) => {
      const text = sectionOf({ client, locale });
      expect(text).toContain(WAKE_NOTES[client][locale]);
      expect(text.indexOf(WAKE_NOTES[client][locale])).toBeLessThan(text.lastIndexOf('send_message'));
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
});
