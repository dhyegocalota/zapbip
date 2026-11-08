import { DocsLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'GeminiCli',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsLanguage.English]: 'Gemini CLI',
      [DocsLanguage.PortugueseBrazil]: 'Gemini CLI',
    },
    linkName: {
      [DocsLanguage.English]: 'Gemini CLI',
      [DocsLanguage.PortugueseBrazil]: 'Gemini CLI',
    },
    pageFacts: {
      [DocsLanguage.English]: ['npx zapbip@0.1.0 listen', 'background terminal'],
      [DocsLanguage.PortugueseBrazil]: ['npx zapbip@0.1.0 listen', 'terminal em segundo plano'],
    },
    speakerNames: ['Gemini CLI', 'Gemini'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
