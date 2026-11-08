import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { GEMINI_CLI_COPY, GEMINI_CLI_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return GEMINI_CLI_COPY[input.locale](input);
}

export const install: AgentInstall = { ...GEMINI_CLI_PRODUCT, render };
