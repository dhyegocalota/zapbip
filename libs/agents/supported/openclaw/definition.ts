import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'OpenClaw',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'OpenClaw' }),
    linkName: perLanguage({ valueOf: () => 'OpenClaw' }),
    pageFacts: perLanguage({
      valueOf: () => [
        'chmod 600',
        'check_inbox',
        '"plugins": { "entries": { "zapbip": { "enabled": true } } }',
        '"channels": { "zapbip": { "connectionLink"',
        'plugin_reply_failed',
      ],
    }),
    speakerNames: ['OpenClaw'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.Local, WakeMode.Scheduled],
  },
};
