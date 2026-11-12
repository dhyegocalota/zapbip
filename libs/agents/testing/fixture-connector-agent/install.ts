import type { AgentInstall } from '../../src/contract';
import { renderFixtureConnectorAgentSection } from './install-copy';

export const install: AgentInstall = {
  productName: 'Fixture Connector Agent',
  productDescription: 'Fixture Connector Agent, the agent the tests use',
  hasOfficialLogo: false,
  quickStart: ({ connectionLink }) => ({ hint: 'Fixture', code: connectionLink, proof: connectionLink }),
  render: renderFixtureConnectorAgentSection,
};
