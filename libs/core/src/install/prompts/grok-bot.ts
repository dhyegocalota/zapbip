import type { InstallSectionInput } from './install-section';
import { GROK_BOT_COPY } from './grok-bot-copy';

export function renderGrokBotSection(input: InstallSectionInput): string {
  return GROK_BOT_COPY[input.locale](input);
}
