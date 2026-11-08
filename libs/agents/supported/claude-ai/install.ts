import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'claude.ai',
  productDescription: 'claude.ai, the chat in the claude.ai web app',
  render: () => {
    throw new Error('claude-ai install section is not implemented');
  },
};
