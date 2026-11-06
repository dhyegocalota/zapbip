import type { OwnerLocale } from '@zapbip/types';

export type InstallPageInput = {
  agent: string;
  connectionLink: string;
  locale: OwnerLocale;
  standbyAgent: string | null;
};

export function renderInstallPage(input: InstallPageInput): string {
  void input;
  throw new Error('renderInstallPage is not implemented');
}
