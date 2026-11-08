import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
  [OwnerLocale.EnglishUs]: 'Cursor listens through the background terminal and answers within seconds while it runs, with no time limit.',
};
const RESTART_MARK: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Reinicie',
  [OwnerLocale.EnglishUs]: 'Restart',
};

describe('the Cursor install section', () => {
  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test.each(LOCALES)('adds the HTTP server and listens in a background terminal in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).toContain('If you are not Cursor');
    expect(text).toContain('over HTTP');
    expect(text).toContain(`npx zapbip@${ZAPBIP_NPM_VERSION} listen`);
    expect(text).toContain('background terminal');
    expect(text).not.toContain('set_wake');
    expect(text).not.toContain('scheduled');
  });

  test.each(LOCALES)('C2 listens in a background terminal without Monitor in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).not.toContain('Monitor');
    expect(text).toContain('Whenever a new line appears there, call check_inbox');
    expect(text).toContain('no time limit');
  });

  test.each(LOCALES)('F11 asks the owner before it adds the server in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text.indexOf('Wait for the owner to answer')).toBeGreaterThan(-1);
    expect(text.indexOf('Wait for the owner to answer')).toBeLessThan(text.indexOf('Add an MCP server'));
  });

  test.each(LOCALES)('ends its setup step with what success looks like in %s', (locale) => {
    expect(install.render(sectionInput({ locale }))).toContain('Success: the Cursor MCP settings list zapbip.');
  });

  test('never uses Grok Bot wording', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).not.toContain('routine');
    expect(text).not.toContain('webhook');
  });

  test.each(LOCALES)('F2 reaches the self-test without a wake call before the restart in %s', (locale) => {
    const text = install.render(sectionInput({ locale }));
    expect(text).not.toContain('mode: "local"');
    expect(text.lastIndexOf(INSTALL_SELF_TEST_TEXT[locale])).toBeGreaterThan(text.indexOf(RESTART_MARK[locale]));
  });
});
