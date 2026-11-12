import { OwnerLocale } from '@zapbip/types';
import type { AgentInstall } from '../../src/contract';
import { addressText, quickStartOf } from '../../src/quick-start';
import { renderFixturePluginAgentSection } from './install-copy';

const FIXTURE_HINT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'O agente que os testes usam',
  [OwnerLocale.EnglishUs]: 'The agent the tests use',
};

const FIXTURE_PATH: Record<OwnerLocale, string[]> = {
  [OwnerLocale.PortugueseBrazil]: ['Abra as configurações', 'Cole este endereço'],
  [OwnerLocale.EnglishUs]: ['Open the settings', 'Paste this address'],
};

export const install: AgentInstall = {
  productName: 'Fixture Plugin Agent',
  productDescription: 'Fixture Plugin Agent, the agent the tests use',
  officialLogo: null,
  quickStart: ({ locale, connectionLink }) => ({
    hint: FIXTURE_HINT[locale],
    path: FIXTURE_PATH[locale],
    code: connectionLink,
    proof: connectionLink,
  }),
  render: renderFixturePluginAgentSection,
};
