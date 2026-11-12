import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { OPENCLAW_COPY, OPENCLAW_PRODUCT, OPENCLAW_QUICK_START } from './install-copy';

function render(input: InstallSectionInput): string {
  return OPENCLAW_COPY[input.locale](input);
}

export const install: AgentInstall = { ...OPENCLAW_PRODUCT, hasOfficialLogo: false, quickStart: OPENCLAW_QUICK_START, render };
