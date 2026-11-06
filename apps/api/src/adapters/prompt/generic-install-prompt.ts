import type { AgentName, InstallPromptRenderer } from '@zapbip/core';
import type { OwnerLocale } from '@zapbip/types';

export function createGenericInstallPromptRenderer(): InstallPromptRenderer {
  return {
    async render(input: { accountId: string; agent: AgentName; connectionLink: string; locale: OwnerLocale }): Promise<string> {
      void input;
      throw new Error('InstallPromptRenderer.render is not implemented');
    },
  };
}
