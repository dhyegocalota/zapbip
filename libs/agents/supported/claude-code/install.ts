import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Claude Code',
  productDescription: 'Claude Code, the agent started by the `claude` command',
  render: () => {
    throw new Error('claude-code install section is not implemented');
  },
};
