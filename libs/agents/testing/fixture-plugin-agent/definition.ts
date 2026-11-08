import { DocsLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'FixturePluginAgent',
  docs: {
    matrixName: { [DocsLanguage.English]: 'Fixture Plugin Agent', [DocsLanguage.PortugueseBrazil]: 'Agente plugin de teste' },
    linkName: { [DocsLanguage.English]: 'Fixture Plugin Agent', [DocsLanguage.PortugueseBrazil]: 'Agente plugin de teste' },
    pageFacts: {
      [DocsLanguage.English]: ['Fixture Plugin Agent hears you'],
      [DocsLanguage.PortugueseBrazil]: ['O Agente plugin de teste ouve você'],
    },
    speakerNames: ['Fixture Plugin Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
