import { OwnerLocale } from '@zapbip/types';
import type { AgentInstall } from '../../src/contract';
import { renderFixturePluginAgentSection } from './install-copy';

const FIXTURE_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O agente que os testes usam',
  [OwnerLocale.EnglishUs]: 'The agent the tests use',
};

export const install: AgentInstall = {
  productName: 'Fixture Plugin Agent',
  productDescription: 'Fixture Plugin Agent, the agent the tests use',
  hasOfficialLogo: false,
  quickStart: ({ locale, connectionLink }) => ({ hint: FIXTURE_HINT[locale], code: connectionLink, proof: connectionLink }),
  render: renderFixturePluginAgentSection,
};
