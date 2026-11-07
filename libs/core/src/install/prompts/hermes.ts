import type { InstallSectionInput } from './install-section';
import { HERMES_COPY } from './hermes-copy';

export function renderHermesSection(input: InstallSectionInput): string {
  return HERMES_COPY[input.locale](input);
}
