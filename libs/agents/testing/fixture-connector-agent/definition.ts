import { DocsLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'FixtureConnectorAgent',
  docs: {
    matrixName: { [DocsLanguage.English]: 'Fixture Connector Agent', [DocsLanguage.PortugueseBrazil]: 'Agente conector de teste' },
    linkName: { [DocsLanguage.English]: 'Fixture Connector Agent', [DocsLanguage.PortugueseBrazil]: 'Agente conector de teste' },
    pageFacts: {
      [DocsLanguage.English]: ['Fixture Connector Agent hears you'],
      [DocsLanguage.PortugueseBrazil]: ['O Agente conector de teste ouve você'],
    },
    speakerNames: ['Fixture Connector Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
