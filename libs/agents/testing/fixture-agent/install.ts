import type { AgentInstall } from '../../src/contract';
import { renderFixtureAgentSection } from './install-copy';

export const install: AgentInstall = {
  productName: 'Fixture Agent',
  productDescription: 'Fixture Agent, the agent the tests use',
  render: renderFixtureAgentSection,
};
