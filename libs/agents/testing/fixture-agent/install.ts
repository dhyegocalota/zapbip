import { OwnerLocale } from '@zapbip/types';
import type { AgentInstall } from '../../src/contract';
import { renderFixtureAgentSection } from './install-copy';

const FIXTURE_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O agente que os testes usam',
  [OwnerLocale.EnglishUs]: 'The agent the tests use',
};

export const install: AgentInstall = {
  productName: 'Fixture Agent',
  productDescription: 'Fixture Agent, the agent the tests use',
  hasOfficialLogo: false,
  quickStart: ({ locale, connectionLink }) => ({ hint: FIXTURE_HINT[locale], path: [], code: connectionLink, proof: connectionLink }),
  render: renderFixtureAgentSection,
};
