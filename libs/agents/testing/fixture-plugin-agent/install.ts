import type { AgentInstall } from '../../src/contract';
import { renderFixturePluginAgentSection } from './install-copy';

export const install: AgentInstall = {
  productName: 'Fixture Plugin Agent',
  productDescription: 'Fixture Plugin Agent, the agent the tests use',
  render: renderFixturePluginAgentSection,
};
