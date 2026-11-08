import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { installSnapshotTests, installWakeNoteTests, sectionInput } from '../../testing/install-fixtures';
import { install } from './install';

const WAKE_NOTE: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O webhook da rotina acorda o Grok Bot em cerca de 9 segundos, sem limite de tempo.',
  [OwnerLocale.EnglishUs]: 'The routine webhook wakes Grok Bot in about 9 seconds, with no time limit.',
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
