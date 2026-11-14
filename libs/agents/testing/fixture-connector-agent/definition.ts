import { DocsPageLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'FixtureConnectorAgent',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      ...perLanguage({ valueOf: () => 'Fixture Connector Agent' }),
      [DocsPageLanguage.PortugueseBrazil]: 'Agente conector de teste',
    },
    linkName: {
      ...perLanguage({ valueOf: () => 'Fixture Connector Agent' }),
      [DocsPageLanguage.PortugueseBrazil]: 'Agente conector de teste',
    },
    pageFacts: {
      ...perLanguage({ valueOf: () => ['Fixture Connector Agent'] }),
      [DocsPageLanguage.English]: ['Fixture Connector Agent hears you'],
      [DocsPageLanguage.PortugueseBrazil]: ['O Agente conector de teste ouve você'],
    },
    speakerNames: ['Fixture Connector Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
