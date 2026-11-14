import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'GrokBot',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Grok Bot' }),
    linkName: perLanguage({ valueOf: () => 'Grok Bot' }),
    pageFacts: perLanguage({ valueOf: () => [] }),
    speakerNames: ['Grok Bot', 'Grok'],
  },
  listen: {
    rung: WakeRung.Webhook,
    expectedDelaySeconds: 9,
    setWakeModes: [WakeMode.Webhook],
  },
};
