import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { GROK_BOT_COPY, GROK_BOT_PRODUCT, GROK_BOT_QUICK_START } from './install-copy';

function render(input: InstallSectionInput): string {
  return GROK_BOT_COPY[input.locale](input);
}

export const install: AgentInstall = { ...GROK_BOT_PRODUCT, officialLogo: null, quickStart: GROK_BOT_QUICK_START, render };
