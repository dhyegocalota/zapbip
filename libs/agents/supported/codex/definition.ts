import { DocsPageLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'Codex',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'Codex' }),
    linkName: perLanguage({ valueOf: () => 'Codex' }),
    pageFacts: {
      [DocsPageLanguage.English]: ['900', 'one call'],
      [DocsPageLanguage.PortugueseBrazil]: ['900', 'uma chamada'],
      [DocsPageLanguage.Spanish]: ['900', 'una llamada'],
      [DocsPageLanguage.German]: ['900', 'ein Aufruf'],
      [DocsPageLanguage.French]: ['900', 'un appel'],
      [DocsPageLanguage.Japanese]: ['900', '1 回の呼び出し'],
      [DocsPageLanguage.Korean]: ['900', '한 번의 호출'],
      [DocsPageLanguage.Chinese]: ['900', '一次调用'],
    },
    speakerNames: ['Codex'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: 6, setWakeModes: [] },
};
