import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { OPENCLAW_COPY, OPENCLAW_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return OPENCLAW_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...OPENCLAW_PRODUCT, hasOfficialLogo: false, quickStart, render };
