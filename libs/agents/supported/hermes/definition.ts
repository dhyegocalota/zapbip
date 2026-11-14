import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'Hermes',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Hermes' }),
    linkName: perLanguage({ valueOf: () => 'Hermes' }),
    pageFacts: perLanguage({ valueOf: () => ['chmod 600', 'check_inbox', 'ZAPBIP_CONNECTION_LINK', 'ZAPBIP_ALLOWED_USERS'] }),
    speakerNames: ['Hermes'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.Local, WakeMode.Scheduled],
  },
};
