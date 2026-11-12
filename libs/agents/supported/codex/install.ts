import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CODEX_COPY, CODEX_PRODUCT, CODEX_QUICK_START } from './install-copy';

function render(input: InstallSectionInput): string {
  return CODEX_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CODEX_PRODUCT, hasOfficialLogo: true, quickStart: CODEX_QUICK_START, render };
