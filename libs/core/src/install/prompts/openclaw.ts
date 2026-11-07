import type { InstallSectionInput } from './install-section';
import { OPENCLAW_COPY } from './openclaw-copy';

export function renderOpenClawSection(input: InstallSectionInput): string {
  return OPENCLAW_COPY[input.locale](input);
}
