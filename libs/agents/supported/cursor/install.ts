import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CURSOR_COPY, CURSOR_PRODUCT, CURSOR_QUICK_START } from './install-copy';

function render(input: InstallSectionInput): string {
  return CURSOR_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CURSOR_PRODUCT, officialLogo: 'cursor', quickStart: CURSOR_QUICK_START, render };
