import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Grok web',
  productDescription: 'Grok web, the chat in the Grok web app',
  render: () => {
    throw new Error('grok-web install section is not implemented');
  },
};
