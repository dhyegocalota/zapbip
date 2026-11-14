import { DocsPageLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'GrokWeb',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsPageLanguage.English]: 'Grok on the web',
      [DocsPageLanguage.PortugueseBrazil]: 'Grok na web',
      [DocsPageLanguage.Spanish]: 'Grok en la web',
      [DocsPageLanguage.German]: 'Grok im Web',
      [DocsPageLanguage.French]: 'Grok sur le web',
      [DocsPageLanguage.Japanese]: 'Web 版 Grok',
      [DocsPageLanguage.Korean]: '웹의 Grok',
      [DocsPageLanguage.Chinese]: '网页版 Grok',
      [DocsPageLanguage.Arabic]: 'Grok على الويب',
      [DocsPageLanguage.Hindi]: 'वेब पर Grok',
    },
    linkName: {
      [DocsPageLanguage.English]: 'Grok on the web',
      [DocsPageLanguage.PortugueseBrazil]: 'Grok na web',
      [DocsPageLanguage.Spanish]: 'Grok en la web',
      [DocsPageLanguage.German]: 'Grok im Web',
      [DocsPageLanguage.French]: 'Grok sur le web',
      [DocsPageLanguage.Japanese]: 'Web 版 Grok',
      [DocsPageLanguage.Korean]: '웹의 Grok',
      [DocsPageLanguage.Chinese]: '网页版 Grok',
      [DocsPageLanguage.Arabic]: 'Grok على الويب',
      [DocsPageLanguage.Hindi]: 'वेब पर Grok',
    },
    pageFacts: {
      [DocsPageLanguage.English]: ['Grok Bot', 'stands in', '60'],
      [DocsPageLanguage.PortugueseBrazil]: ['Grok Bot', 'atende no lugar', '60'],
      [DocsPageLanguage.Spanish]: ['Grok Bot', 'responde en su lugar', '60'],
      [DocsPageLanguage.German]: ['Grok Bot', 'springt ein', '60'],
      [DocsPageLanguage.French]: ['Grok Bot', 'prend le relais', '60'],
      [DocsPageLanguage.Japanese]: ['Grok Bot', '代わりに応答', '60'],
      [DocsPageLanguage.Korean]: ['Grok Bot', '대신 응답', '60'],
      [DocsPageLanguage.Chinese]: ['Grok Bot', '代为回复', '60'],
      [DocsPageLanguage.Arabic]: ['Grok Bot', 'يرد نيابةً عنه', '60'],
      [DocsPageLanguage.Hindi]: ['Grok Bot', 'जगह जवाब', '60'],
    },
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Standby,
    expectedDelaySeconds: null,
    setWakeModes: [WakeMode.None, WakeMode.Standby],
  },
};
