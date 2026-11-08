import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CHATGPT_COPY, CHATGPT_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CHATGPT_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CHATGPT_PRODUCT, render };
