import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'ClaudeAi',
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'claude.ai',
      [DocsLanguage.PortugueseBrazil]: 'claude.ai',
    },
    linkName: {
      [DocsLanguage.English]: 'claude.ai',
      [DocsLanguage.PortugueseBrazil]: 'claude.ai',
    },
    pageFacts: {
      [DocsLanguage.English]: ['hour', 'safety net'],
      [DocsLanguage.PortugueseBrazil]: ['hora', 'rede de segurança'],
    },
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Webhook,
    expectedDelaySeconds: 16,
    setWakeModes: [WakeMode.Webhook, WakeMode.None],
  },
};
