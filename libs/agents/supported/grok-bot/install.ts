import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Grok Bot',
  productDescription: 'Grok Bot, the Grok routines bot',
  render: () => {
    throw new Error('grok-bot install section is not implemented');
  },
};
