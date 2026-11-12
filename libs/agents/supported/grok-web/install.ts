import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { GROK_WEB_COPY, GROK_WEB_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return GROK_WEB_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...GROK_WEB_PRODUCT, hasOfficialLogo: false, quickStart, render };
