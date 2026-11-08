import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'GrokWeb',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Grok on the web',
      [DocsLanguage.PortugueseBrazil]: 'Grok na web',
    },
    linkName: {
      [DocsLanguage.English]: 'Grok on the web',
      [DocsLanguage.PortugueseBrazil]: 'Grok na web',
    },
    pageFacts: {
      [DocsLanguage.English]: ['Grok Bot', 'stands in', '60'],
      [DocsLanguage.PortugueseBrazil]: ['Grok Bot', 'atende no lugar', '60'],
    },
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Standby,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.None, WakeMode.Standby],
  },
};
