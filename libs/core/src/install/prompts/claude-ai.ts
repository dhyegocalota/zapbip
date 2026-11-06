import type { InstallSectionInput } from './install-section';
import { CLAUDE_AI_COPY } from './claude-ai-copy';

export function renderClaudeAiSection(input: InstallSectionInput): string {
  return CLAUDE_AI_COPY[input.locale](input);
}
