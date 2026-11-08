import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'OpenClaw',
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'OpenClaw',
      [DocsLanguage.PortugueseBrazil]: 'OpenClaw',
    },
    linkName: {
      [DocsLanguage.English]: 'OpenClaw',
      [DocsLanguage.PortugueseBrazil]: 'OpenClaw',
    },
    pageFacts: {
      [DocsLanguage.English]: ['chmod 600', 'check_inbox'],
      [DocsLanguage.PortugueseBrazil]: ['chmod 600', 'check_inbox'],
    },
    speakerNames: ['OpenClaw'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.Local, WakeMode.Scheduled],
  },
};
