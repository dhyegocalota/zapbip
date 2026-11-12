import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CHATGPT_COPY, CHATGPT_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CHATGPT_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...CHATGPT_PRODUCT, hasOfficialLogo: false, quickStart, render };
