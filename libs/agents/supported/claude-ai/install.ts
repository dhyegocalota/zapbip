import type { InstallSectionInput } from '@zapbip/core';
import type { AgentInstall } from '../../src/contract';
import { CLAUDE_AI_COPY, CLAUDE_AI_PRODUCT } from './install-copy';

function render(input: InstallSectionInput): string {
  return CLAUDE_AI_COPY[input.locale](input);
}

export const install: AgentInstall = { ...CLAUDE_AI_PRODUCT, render };
