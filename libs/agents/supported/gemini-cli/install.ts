import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Gemini CLI',
  productDescription: 'Gemini CLI, the agent started by the `gemini` command',
  render: () => {
    throw new Error('gemini-cli install section is not implemented');
  },
};
