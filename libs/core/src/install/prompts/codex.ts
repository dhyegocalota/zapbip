import type { InstallSectionInput } from './install-section';
import { CODEX_COPY } from './codex-copy';

export function renderCodexSection(input: InstallSectionInput): string {
  return CODEX_COPY[input.locale](input);
}
