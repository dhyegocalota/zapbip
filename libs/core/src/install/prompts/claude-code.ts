import type { InstallSectionInput } from './install-section';
import { CLAUDE_CODE_COPY } from './claude-code-copy';

export function renderClaudeCodeSection(input: InstallSectionInput): string {
  return CLAUDE_CODE_COPY[input.locale](input);
}
