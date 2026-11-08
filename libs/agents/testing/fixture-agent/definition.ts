import { DocsLanguage, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';

export const definition: AgentDefinition = {
  enumMember: 'FixtureAgent',
  docs: {
    matrixName: { [DocsLanguage.English]: 'Fixture Agent', [DocsLanguage.PortugueseBrazil]: 'Agente de teste' },
    linkName: { [DocsLanguage.English]: 'Fixture Agent', [DocsLanguage.PortugueseBrazil]: 'Agente de teste' },
    pageFacts: { [DocsLanguage.English]: ['Fixture Agent hears you'], [DocsLanguage.PortugueseBrazil]: ['O Agente de teste ouve você'] },
    speakerNames: ['Fixture Agent'],
  },
  listen: { rung: WakeRung.Local, expectedDelaySeconds: null, setWakeModes: [] },
};
