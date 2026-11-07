import type { InstallSectionInput } from './install-section';
import { CHATGPT_COPY } from './chatgpt-copy';

export function renderChatGptSection(input: InstallSectionInput): string {
  return CHATGPT_COPY[input.locale](input);
}
