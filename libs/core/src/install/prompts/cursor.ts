import type { InstallSectionInput } from './install-section';
import { CURSOR_COPY } from './cursor-copy';

export function renderCursorSection(input: InstallSectionInput): string {
  return CURSOR_COPY[input.locale](input);
}
