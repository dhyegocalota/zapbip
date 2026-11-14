import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'Cursor',
  idIsOrdinaryWord: true,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Cursor' }),
    linkName: perLanguage({ valueOf: () => 'Cursor' }),
    pageFacts: perLanguage({ valueOf: () => ['npx zapbip@0.1.0 listen'] }),
    speakerNames: ['Cursor'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
