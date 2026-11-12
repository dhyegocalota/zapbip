import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { HERMES_COPY, HERMES_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return HERMES_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...HERMES_PRODUCT, hasOfficialLogo: false, quickStart, render };
