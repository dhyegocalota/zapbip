import { AGENT_RULES } from '@zapbip/core';
import { INSTALL_SELF_TEST_TEXT, OwnerLocale, ZAPBIP_NPM_VERSION } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, installSnapshotTests, installWakeNoteTests, LOCALES, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O Claude Code escuta sem limite de tempo: o canal entrega na hora com a sessão aberta, e o conector retoma uma sessão parada em cerca de 7 segundos.',
  [OwnerLocale.EnglishUs]:
    'Claude Code listens with no time limit: the channel delivers at once while the session is open, and the connector resumes a stopped session in about 7 seconds.',
  [OwnerLocale.Spanish]:
    'Claude Code escucha sin límite de tiempo: el canal entrega al instante mientras la sesión está abierta, y el conector reanuda una sesión detenida en unos 7 segundos.',
  [OwnerLocale.German]:
    'Claude Code hört ohne Zeitlimit zu: Der Kanal liefert sofort, solange die Sitzung offen ist, und der Connector setzt eine gestoppte Sitzung in etwa 7 Sekunden fort.',
  [OwnerLocale.French]:
    'Claude Code écoute sans limite de temps\u00a0: le canal livre aussitôt tant que la session est ouverte, et le connecteur reprend une session arrêtée en environ 7 secondes.',
  [OwnerLocale.Japanese]:
    'Claude Codeは時間制限なしで待ち受けます。セッションが開いている間はチャンネルが即座に配信し、止まったセッションはコネクタが約7秒で再開します。',
  [OwnerLocale.Korean]:
    'Claude Code는 시간 제한 없이 듣습니다. 세션이 열려 있는 동안에는 채널이 즉시 전달하고, 멈춘 세션은 커넥터가 약 7초 만에 재개합니다.',
  [OwnerLocale.ChineseSimplified]: 'Claude Code 不限时地监听：会话打开时，通道会立即送达；会话停止时，连接器大约 7 秒就能让它恢复。',
};
const SKILL_DESCRIPTION = 'Rules for talking to the owner on WhatsApp through zapbip: ask, wait for the answer and write short.';
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

describe('the Claude Code install section', () => {
  const locale = OwnerLocale.EnglishUs;
  const text = install.render(sectionInput({ locale }));

  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('removes the old entry before adding the server', () => {
    const removeAt = text.indexOf('claude mcp remove --scope user zapbip');
    const addAt = text.indexOf(`claude mcp add --transport http --scope user zapbip ${CONNECTION_LINK}`);
    expect(removeAt).toBeGreaterThan(-1);
    expect(addAt).toBeGreaterThan(removeAt);
  });

  test('writes the skill with the agent rules as its body', () => {
    expect(text).toContain('~/.claude/skills/zapbip/SKILL.md');
    expect(text).toContain(`name: zapbip\ndescription: ${SKILL_DESCRIPTION}\n---\n${AGENT_RULES}`);
  });

  test('runs the pinned connector and leaves the local wake mode to the attach', () => {
    expect(text).toContain(`ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} npx zapbip@${ZAPBIP_NPM_VERSION} connect --client claude-code`);
    expect(text).not.toContain('set_wake');
  });

  test('F1 registers the local channel server and launches the session with it', () => {
    expect(text).toContain(
      `claude mcp add --scope user zapbip-channel -e ZAPBIP_CONNECTION_URL=${CONNECTION_LINK} -- npx zapbip@${ZAPBIP_NPM_VERSION} channel`,
    );
    expect(text).toContain('claude --dangerously-load-development-channels server:zapbip-channel');
    expect(text).not.toMatch(/server:zapbip(?!-channel)/);
    expect(text).toContain('claude mcp remove --scope user zapbip-channel');
  });

  test('lists the channel as primary and the monitored listener as fallback', () => {
    expect(text).toContain('claude --dangerously-load-development-channels server:zapbip-channel');
    expect(text).toContain(`npx zapbip@${ZAPBIP_NPM_VERSION} listen`);
    expect(text).toContain('Monitor');
    expect(text).toContain('re-arm');
    expect(text).toContain('claude -p --resume');
  });

  test('gives a rule for which listener to run and ends every setup step with its success', () => {
    const listenerStep = text.split('\n').find((line) => line.includes('exactly one of these'));
    expect(listenerStep).toContain('If the session supports development channels');
    expect(listenerStep).toContain('If connect cannot run either, listen instead.');
    expect(text).not.toContain(': In a');
    expect(text).toContain('Success: `claude mcp list` shows zapbip.');
    expect(text).toContain('Success: `claude mcp list` shows zapbip-channel.');
    expect(text).toContain('Success: the file holds exactly that content.');
    expect(text).toContain('Success: exactly one listener is running.');
  });

  test('explains the channel flag to the owner', () => {
    expect(text).toContain("turns on Claude Code's channel feature for zapbip and does not approve any tool by itself");
  });

  test('self-tests in a fresh process', () => {
    expect(text).toContain('claude -p');
    expect(text).toContain('--allowedTools=mcp__zapbip__send_message');
    expect(text).toContain(INSTALL_SELF_TEST_TEXT[locale]);
  });

  test.each(LOCALES)('C5 runs one listener per connection in %s', (sectionLocale) => {
    const sectionText = install.render(sectionInput({ locale: sectionLocale }));
    expect(sectionText).toContain(
      'A connection holds one listener and a second replaces the first: use exactly one of these, never two together.',
    );
    expect(sectionText.match(/npx zapbip@\S+ connect/g)).toHaveLength(1);
  });

  test.each(LOCALES)('F2 reaches the self-test without a wake call before the restart in %s', (sectionLocale) => {
    const sectionText = install.render(sectionInput({ locale: sectionLocale }));
    expect(sectionText).not.toContain('mode: "local"');
    expect(sectionText.lastIndexOf(INSTALL_SELF_TEST_TEXT[sectionLocale])).toBeGreaterThan(
      sectionText.indexOf(RESTART_MARK[sectionLocale]),
    );
  });
});
