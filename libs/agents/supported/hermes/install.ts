import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { HERMES_COPY, HERMES_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return HERMES_COPY[input.locale](input);
}

export const install: AgentInstall = { ...HERMES_PRODUCT, render };
