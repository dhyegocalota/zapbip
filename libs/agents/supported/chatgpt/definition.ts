import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'ChatGpt',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'ChatGPT',
      [DocsLanguage.PortugueseBrazil]: 'ChatGPT',
    },
    linkName: {
      [DocsLanguage.English]: 'ChatGPT',
      [DocsLanguage.PortugueseBrazil]: 'ChatGPT',
    },
    pageFacts: {
      [DocsLanguage.English]: [],
      [DocsLanguage.PortugueseBrazil]: [],
    },
    speakerNames: ['ChatGPT'],
  },
  listen: {
    rung: WakeRung.Scheduled,
    expectedDelaySeconds: 3600,
    setWakeModes: [WakeMode.Scheduled],
  },
};
