import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'Codex',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Codex',
      [DocsLanguage.PortugueseBrazil]: 'Codex',
    },
    linkName: {
      [DocsLanguage.English]: 'Codex',
      [DocsLanguage.PortugueseBrazil]: 'Codex',
    },
    pageFacts: {
      [DocsLanguage.English]: ['900', 'one call'],
      [DocsLanguage.PortugueseBrazil]: ['900', 'uma chamada'],
    },
    speakerNames: ['Codex'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: 6, setWakeModes: [] },
};
