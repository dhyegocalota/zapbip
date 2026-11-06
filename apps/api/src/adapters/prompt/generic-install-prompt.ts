import type { AgentName, InstallPromptRenderer } from '@zapbip/core';
import type { OwnerLocale } from '@zapbip/types';
import { GENERIC_INSTALL_PROMPT_COPY } from './generic-install-prompt-copy';

const LINE_SEPARATOR = '\n';

export function createGenericInstallPromptRenderer(): InstallPromptRenderer {
  return {
    async render(input: { accountId: string; agent: AgentName; connectionLink: string; locale: OwnerLocale }): Promise<string> {
      const copy = GENERIC_INSTALL_PROMPT_COPY[input.locale];
      return [copy.introduction({ agent: input.agent }), input.connectionLink, copy.warning({ agent: input.agent })].join(LINE_SEPARATOR);
    },
  };
}
