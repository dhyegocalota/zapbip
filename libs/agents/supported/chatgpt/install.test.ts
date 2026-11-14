import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const POLL_INTERVAL_MINUTES = 60;
const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora.',
  [OwnerLocale.EnglishUs]: 'ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour.',
  [OwnerLocale.Spanish]: 'ChatGPT se despierta con una tarea programada cada hora: un mensaje puede esperar hasta una hora.',
  [OwnerLocale.German]: 'ChatGPT wird jede Stunde von einer geplanten Aufgabe geweckt: Eine Nachricht kann bis zu einer Stunde warten.',
  [OwnerLocale.French]: 'ChatGPT est réveillé toutes les heures par une tâche planifiée\u00a0: un message peut attendre jusqu’à une heure.',
  [OwnerLocale.Japanese]: 'ChatGPTは1時間ごとにスケジュールされたタスクで起動します。メッセージは最長1時間待つことがあります。',
  [OwnerLocale.Korean]: 'ChatGPT는 1시간마다 예약 작업으로 깨어납니다. 메시지는 최대 1시간 기다릴 수 있습니다.',
  [OwnerLocale.ChineseSimplified]: 'ChatGPT 每小时由一个计划任务唤醒：一条消息最多可能要等一个小时。',
};

describe('the ChatGPT install section', () => {
  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('names developer mode, no authentication, the local task and always allow', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).toContain('developer mode');
    expect(text).toContain('`No authentication`');
    expect(text).toContain('`Run on this computer`');
    expect(text).toContain('`Always allow`');
    expect(text).toContain(`set_wake({mode: "scheduled", interval_minutes: ${POLL_INTERVAL_MINUTES}})`);
  });

  test('F9 gives the localized label beside the English one in Portuguese', () => {
    const text = install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }));
    expect(text).toContain('Executar neste computador (`Run on this computer`)');
    expect(text).toContain('Sempre permitir (`Always allow`)');
  });
});
