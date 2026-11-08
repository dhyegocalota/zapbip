import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { GROK_WEB_COPY, GROK_WEB_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return GROK_WEB_COPY[input.locale](input);
}

export const install: AgentInstall = { ...GROK_WEB_PRODUCT, render };
