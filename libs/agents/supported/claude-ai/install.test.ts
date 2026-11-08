import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]:
    'O webhook da rotina acorda o claude.ai em cerca de 16 segundos; a tarefa agendada de segurança roda no máximo uma vez a cada 60 minutos, limite da plataforma.',
  [OwnerLocale.EnglishUs]:
    'The routine webhook wakes claude.ai in about 16 seconds; the safety-net scheduled task runs at most once every 60 minutes, a platform minimum.',
};

describe('the claude.ai install section', () => {
  const text = install.render(sectionInput({ locale: OwnerLocale.EnglishUs }));

  installSnapshotTests({ install });
  installWakeNoteTests({ install, wakeNote: WAKE_NOTE });

  test('asks for the connector paste and the fire URL and token', () => {
    expect(text).toContain('custom connector');
    expect(text).toContain('fire URL and token');
    expect(text).toContain('set_wake({mode: "webhook"');
  });

  test('asks for the hourly check_inbox safety net and has the stop branch', () => {
    expect(text).toContain('hourly');
    expect(text).toContain('check_inbox');
    expect(text).toContain('set_wake({mode: "none"})');
  });

  test('C1 holds no English trigger wording in Portuguese', () => {
    expect(install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).not.toContain('fire URL and token');
  });

  test('F10 says in Portuguese the safety net runs at most once every 60 minutes', () => {
    expect(install.render(sectionInput({ locale: OwnerLocale.PortugueseBrazil }))).toContain('no máximo uma vez a cada 60 minutos');
  });
});
