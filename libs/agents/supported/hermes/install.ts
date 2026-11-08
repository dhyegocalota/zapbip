import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Hermes',
  productDescription: 'Hermes, the agent running Hermes',
  render: () => {
    throw new Error('hermes install section is not implemented');
  },
};
