import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'Cursor',
  idIsOrdinaryWord: true,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Cursor',
      [DocsLanguage.PortugueseBrazil]: 'Cursor',
    },
    linkName: {
      [DocsLanguage.English]: 'Cursor',
      [DocsLanguage.PortugueseBrazil]: 'Cursor',
    },
    pageFacts: {
      [DocsLanguage.English]: ['npx zapbip@0.1.0 listen'],
      [DocsLanguage.PortugueseBrazil]: ['npx zapbip@0.1.0 listen'],
    },
    speakerNames: ['Cursor'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
