import { DocsPageLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'ClaudeAi',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: perLanguage({ valueOf: () => 'claude.ai' }),
    linkName: perLanguage({ valueOf: () => 'claude.ai' }),
    pageFacts: {
      [DocsPageLanguage.English]: ['hour', 'safety net'],
      [DocsPageLanguage.PortugueseBrazil]: ['hora', 'rede de segurança'],
      [DocsPageLanguage.Spanish]: ['hora', 'red de seguridad'],
      [DocsPageLanguage.German]: ['Stunde', 'Sicherheitsnetz'],
      [DocsPageLanguage.French]: ['heure', 'filet de sécurité'],
      [DocsPageLanguage.Japanese]: ['1 時間', 'セーフティネット'],
      [DocsPageLanguage.Korean]: ['1시간', '안전망'],
      [DocsPageLanguage.Chinese]: ['小时', '安全网'],
      [DocsPageLanguage.Arabic]: ['ساعة', 'شبكة أمان'],
      [DocsPageLanguage.Hindi]: ['घंटे', 'सेफ़्टी नेट'],
    },
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Webhook,
    expectedDelaySeconds: 16,
    setWakeModes: [WakeMode.Webhook, WakeMode.None],
  },
};
