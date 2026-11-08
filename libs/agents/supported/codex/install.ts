import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Codex',
  productDescription: 'Codex, the agent started by the `codex` command',
  render: () => {
    throw new Error('codex install section is not implemented');
  },
};
