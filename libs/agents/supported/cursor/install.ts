import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CURSOR_COPY, CURSOR_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CURSOR_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CURSOR_PRODUCT, render };
