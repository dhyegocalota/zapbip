import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'OpenClaw',
  productDescription: 'OpenClaw, the agent running OpenClaw',
  render: () => {
    throw new Error('openclaw install section is not implemented');
  },
};
