import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'ClaudeCode',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Claude Code',
      [DocsLanguage.PortugueseBrazil]: 'Claude Code',
    },
    linkName: {
      [DocsLanguage.English]: 'Claude Code',
      [DocsLanguage.PortugueseBrazil]: 'Claude Code',
    },
    pageFacts: {
      [DocsLanguage.English]: ['claude --dangerously-load-development-channels server:zapbip-channel'],
      [DocsLanguage.PortugueseBrazil]: ['claude --dangerously-load-development-channels server:zapbip-channel'],
    },
    speakerNames: ['Claude Code', 'Claude'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: 7, setWakeModes: [] },
};
