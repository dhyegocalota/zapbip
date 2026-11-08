import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'Cursor',
  productDescription: 'Cursor, the AI code editor and its chat panel',
  render: () => {
    throw new Error('cursor install section is not implemented');
  },
};
