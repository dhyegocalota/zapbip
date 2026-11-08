import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'Hermes',
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Hermes',
      [DocsLanguage.PortugueseBrazil]: 'Hermes',
    },
    linkName: {
      [DocsLanguage.English]: 'Hermes',
      [DocsLanguage.PortugueseBrazil]: 'Hermes',
    },
    pageFacts: {
      [DocsLanguage.English]: ['chmod 600', 'check_inbox'],
      [DocsLanguage.PortugueseBrazil]: ['chmod 600', 'check_inbox'],
    },
    speakerNames: ['Hermes'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.Local, WakeMode.Scheduled],
  },
};
