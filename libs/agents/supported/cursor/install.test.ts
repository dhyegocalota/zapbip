import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O Cursor escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo.',
  [OwnerLocale.EnglishUs]: 'Cursor listens through the background terminal and answers within seconds while it runs, with no time limit.',
  [OwnerLocale.Spanish]:
    'Cursor escucha a través de la terminal en segundo plano y responde en segundos mientras se ejecuta, sin límite de tiempo.',
  [OwnerLocale.German]: 'Cursor hört über das Hintergrund-Terminal zu und antwortet in Sekunden, solange es läuft, ohne Zeitlimit.',
  [OwnerLocale.French]:
    'Cursor écoute via le terminal en arrière-plan et répond en quelques secondes tant qu’il tourne, sans limite de temps.',
  [OwnerLocale.Japanese]: 'Cursorはバックグラウンドのターミナルを通じて待ち受け、実行中は数秒で応答します。時間制限はありません。',
  [OwnerLocale.Korean]: 'Cursor는 백그라운드 터미널을 통해 듣고, 실행되는 동안 몇 초 안에 답합니다. 시간 제한은 없습니다.',
  [OwnerLocale.ChineseSimplified]: 'Cursor 通过后台终端监听，运行期间几秒内就会回应，不限时。',
};
const RESTART_MARK: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Reinicie',
  [OwnerLocale.EnglishUs]: 'Restart',
  [OwnerLocale.Spanish]: 'Reinicia',
  [OwnerLocale.German]: 'Starte',
  [OwnerLocale.French]: 'Redémarrez',
  [OwnerLocale.Japanese]: '再起動',
  [OwnerLocale.Korean]: '다시 시작',
  [OwnerLocale.ChineseSimplified]: '重新启动',
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
