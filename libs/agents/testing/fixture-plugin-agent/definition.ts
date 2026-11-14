import { DocsPageLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'FixturePluginAgent',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      ...perLanguage({ valueOf: () => 'Fixture Plugin Agent' }),
      [DocsPageLanguage.PortugueseBrazil]: 'Agente plugin de teste',
    },
    linkName: { ...perLanguage({ valueOf: () => 'Fixture Plugin Agent' }), [DocsPageLanguage.PortugueseBrazil]: 'Agente plugin de teste' },
    pageFacts: {
      ...perLanguage({ valueOf: () => ['Fixture Plugin Agent'] }),
      [DocsPageLanguage.English]: ['Fixture Plugin Agent hears you'],
      [DocsPageLanguage.PortugueseBrazil]: ['O Agente plugin de teste ouve você'],
    },
    speakerNames: ['Fixture Plugin Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
