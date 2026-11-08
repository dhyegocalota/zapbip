import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'GrokBot',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Grok Bot',
      [DocsLanguage.PortugueseBrazil]: 'Grok Bot',
    },
    linkName: {
      [DocsLanguage.English]: 'Grok Bot',
      [DocsLanguage.PortugueseBrazil]: 'Grok Bot',
    },
    pageFacts: {
      [DocsLanguage.English]: [],
      [DocsLanguage.PortugueseBrazil]: [],
    },
    speakerNames: ['Grok Bot', 'Grok'],
  },
  listen: {
    rung: WakeRung.Webhook,
    expectedDelaySeconds: 9,
    setWakeModes: [WakeMode.Webhook],
  },
};
