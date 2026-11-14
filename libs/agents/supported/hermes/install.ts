import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { HERMES_COPY, HERMES_PRODUCT, HERMES_QUICK_START } from './install-copy';

function render(input: InstallSectionInput): string {
  return HERMES_COPY[input.locale](input);
}

export const install: AgentInstall = { ...HERMES_PRODUCT, officialLogo: 'hermes', quickStart: HERMES_QUICK_START, render };
