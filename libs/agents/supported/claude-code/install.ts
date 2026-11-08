import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CLAUDE_CODE_COPY, CLAUDE_CODE_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CLAUDE_CODE_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CLAUDE_CODE_PRODUCT, render };
