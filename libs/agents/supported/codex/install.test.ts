import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const TOOL_TIMEOUT_SECONDS = 900;
const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O conector retoma a sessão do Codex a cada mensagem, em cerca de 6 segundos, sem limite de tempo.',
  [OwnerLocale.EnglishUs]: 'The connector resumes the Codex session on each message, in about 6 seconds, with no time limit.',
  [OwnerLocale.Spanish]: 'El conector reanuda la sesión de Codex con cada mensaje, en unos 6 segundos y sin límite de tiempo.',
  [OwnerLocale.German]: 'Der Connector setzt die Codex-Sitzung bei jeder Nachricht fort, in etwa 6 Sekunden und ohne Zeitlimit.',
  [OwnerLocale.French]: 'Le connecteur reprend la session Codex à chaque message, en environ 6 secondes et sans limite de temps.',
  [OwnerLocale.Japanese]: 'コネクタはメッセージが届くたびにCodexのセッションを約6秒で再開します。時間制限はありません。',
  [OwnerLocale.Korean]: '커넥터가 메시지마다 약 6초 만에 Codex 세션을 재개해요. 시간 제한은 없어요.',
  [OwnerLocale.ChineseSimplified]: '连接器会在每条消息到来时恢复 Codex 会话，大约 6 秒，不限时。',
  [OwnerLocale.Arabic]: 'يستأنف الموصّل جلسة Codex مع كل رسالة، خلال نحو 6 ثوانٍ ودون حد زمني.',
  [OwnerLocale.Hindi]: 'कनेक्टर हर संदेश पर Codex सेशन को करीब 6 सेकंड में फिर से शुरू करता है, बिना किसी समय-सीमा के।',
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
  [OwnerLocale.Arabic]: 'أعد تشغيل',
  [OwnerLocale.Hindi]: 'फिर से शुरू करें',
};

describe('the Codex install section', () => {
  const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));

  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('replaces the zapbip table with the url, timeout and approval mode', () => {
    expect(text).toContain('[mcp_servers.zapbip]');
    expect(text).toContain(`url = "${CONNECTION_LINK}"`);
    expect(text).toContain(`tool_timeout_sec = ${TOOL_TIMEOUT_SECONDS}`);
    expect(text).toContain('default_tools_approval_mode = "approve"');
  });

  test('removes an existing table first and never appends a second one', () => {
    expect(text).toContain('Remove any existing [mcp_servers.zapbip] table');
    expect(text.match(/^\[mcp_servers\.zapbip\]$/gm)).toHaveLength(1);
  });

  test('warns the owner that tools run unattended in each locale', () => {
    expect(text).toContain('unattended');
    expect(install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).toContain('sem supervisão');
  });

  test('runs the pinned connector and leaves the local wake mode to the attach', () => {
    expect(text).toContain(`ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} npx zapbip@${ZAPBIP_NPM_VERSION} connect --client codex`);
    expect(text).not.toContain('set_wake');
    expect(text).toContain('codex exec resume');
  });

  test('self-tests in a fresh process', () => {
    expect(text).toContain(`codex exec -c 'mcp_servers.zapbip.default_tools_approval_mode="approve"'`);
  });

  test.each(LOCALES)('F2 reaches the self-test without a wake call before the restart in %s', (locale) => {
    const sectionText = install.render(sectionInput({ locale }));
    expect(sectionText).not.toContain('mode: "local"');
    expect(sectionText.lastIndexOf(INSTALL_SELF_TEST_TEXT[locale])).toBeGreaterThan(sectionText.indexOf(RESTART_MARK[locale]));
  });
});
