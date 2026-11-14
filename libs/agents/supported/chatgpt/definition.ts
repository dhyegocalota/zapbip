import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'ChatGpt',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'ChatGPT' }),
    linkName: perLanguage({ valueOf: () => 'ChatGPT' }),
    pageFacts: perLanguage({ valueOf: () => [] }),
    speakerNames: ['ChatGPT'],
  },
  listen: {
    rung: WakeRung.Scheduled,
    expectedDelaySeconds: 3600,
    setWakeModes: [WakeMode.Scheduled],
  },
};
