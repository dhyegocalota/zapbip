import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const POLL_INTERVAL_MINUTES = 60;
const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora.',
  [OwnerLocale.EnglishUs]: 'ChatGPT is woken by a scheduled task every hour: a message can wait up to an hour.',
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
