import type { InstallSectionInput } from './install-section';
import { GROK_WEB_COPY } from './grok-web-copy';

export function renderGrokWebSection(input: InstallSectionInput): string {
  return GROK_WEB_COPY[input.locale](input);
}
