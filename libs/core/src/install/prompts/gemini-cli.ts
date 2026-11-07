import type { InstallSectionInput } from './install-section';
import { GEMINI_CLI_COPY } from './gemini-cli-copy';

export function renderGeminiCliSection(input: InstallSectionInput): string {
  return GEMINI_CLI_COPY[input.locale](input);
}
