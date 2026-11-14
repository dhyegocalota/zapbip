import { WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'ClaudeCode',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Claude Code' }),
    linkName: perLanguage({ valueOf: () => 'Claude Code' }),
    pageFacts: perLanguage({ valueOf: () => ['claude --dangerously-load-development-channels server:zapbip-channel'] }),
    speakerNames: ['Claude Code', 'Claude'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: 7, setWakeModes: [] },
};
