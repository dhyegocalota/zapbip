import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O webhook da rotina acorda o Grok Bot em cerca de 9 segundos, sem limite de tempo.',
  [OwnerLocale.EnglishUs]: 'The routine webhook wakes Grok Bot in about 9 seconds, with no time limit.',
  [OwnerLocale.Spanish]: 'El webhook de la rutina despierta a Grok Bot en unos 9 segundos, sin límite de tiempo.',
  [OwnerLocale.German]: 'Der Routine-Webhook weckt Grok Bot in etwa 9 Sekunden, ohne Zeitlimit.',
  [OwnerLocale.French]: 'Le webhook de la routine réveille Grok Bot en environ 9 secondes, sans limite de temps.',
  [OwnerLocale.Japanese]: 'ルーティンのWebhookは約9秒でGrok Botを起動します。時間制限はありません。',
  [OwnerLocale.Korean]: '루틴 웹훅은 약 9초 만에 Grok Bot을 깨웁니다. 시간 제한은 없습니다.',
  [OwnerLocale.ChineseSimplified]: '例行任务的 Webhook 大约 9 秒就能唤醒 Grok Bot，不限时。',
};

describe('the Grok Bot install section', () => {
  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('adds the server, asks for confirmation and creates the webhook routine', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).toContain('MCP server named zapbip');
    expect(text).toContain('confirm');
    expect(text).toContain('routine with a webhook trigger');
    expect(text).toContain('set_wake({mode: "webhook"');
  });
});
