import { DocsPageLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'FixtureAgent',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: { ...perLanguage({ valueOf: () => 'Fixture Agent' }), [DocsPageLanguage.PortugueseBrazil]: 'Agente de teste' },
    linkName: { ...perLanguage({ valueOf: () => 'Fixture Agent' }), [DocsPageLanguage.PortugueseBrazil]: 'Agente de teste' },
    pageFacts: {
      ...perLanguage({ valueOf: () => ['Fixture Agent'] }),
      [DocsPageLanguage.English]: ['Fixture Agent hears you'],
      [DocsPageLanguage.PortugueseBrazil]: ['O Agente de teste ouve você'],
    },
    speakerNames: ['Fixture Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
