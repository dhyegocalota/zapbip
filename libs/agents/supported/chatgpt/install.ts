import type { AgentInstall } from '../../src/contract';

export const install: AgentInstall = {
  productName: 'ChatGPT',
  productDescription: 'ChatGPT, the chat in the ChatGPT web app',
  render: () => {
    throw new Error('chatgpt install section is not implemented');
  },
};
