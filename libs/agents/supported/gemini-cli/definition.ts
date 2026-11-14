import { DocsPageLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'GeminiCli',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Gemini CLI' }),
    linkName: perLanguage({ valueOf: () => 'Gemini CLI' }),
    pageFacts: {
      [DocsPageLanguage.English]: ['npx zapbip@0.1.0 listen', 'background terminal'],
      [DocsPageLanguage.PortugueseBrazil]: ['npx zapbip@0.1.0 listen', 'terminal em segundo plano'],
      [DocsPageLanguage.Spanish]: ['npx zapbip@0.1.0 listen', 'terminal en segundo plano'],
      [DocsPageLanguage.German]: ['npx zapbip@0.1.0 listen', 'Hintergrundterminal'],
      [DocsPageLanguage.French]: ['npx zapbip@0.1.0 listen', 'terminal en arrière-plan'],
      [DocsPageLanguage.Japanese]: ['npx zapbip@0.1.0 listen', 'バックグラウンドのターミナル'],
      [DocsPageLanguage.Korean]: ['npx zapbip@0.1.0 listen', '백그라운드 터미널'],
      [DocsPageLanguage.Chinese]: ['npx zapbip@0.1.0 listen', '后台终端'],
      [DocsPageLanguage.Arabic]: ['npx zapbip@0.1.0 listen', 'الطرفية الخلفية'],
      [DocsPageLanguage.Hindi]: ['npx zapbip@0.1.0 listen', 'बैकग्राउंड टर्मिनल'],
    },
    speakerNames: ['Gemini CLI', 'Gemini'],
  },
  listen: {
    rung: WakeRung.Local,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
