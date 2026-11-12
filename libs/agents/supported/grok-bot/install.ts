import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { GROK_BOT_COPY, GROK_BOT_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return GROK_BOT_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...GROK_BOT_PRODUCT, hasOfficialLogo: false, quickStart, render };
