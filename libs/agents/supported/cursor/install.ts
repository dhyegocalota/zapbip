import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CURSOR_COPY, CURSOR_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CURSOR_COPY[input.locale](input);
}

function quickStart(): never {
  throw new Error('quickStart is not implemented');
}

export const install: AgentInstall = { ...CURSOR_PRODUCT, hasOfficialLogo: false, quickStart, render };
