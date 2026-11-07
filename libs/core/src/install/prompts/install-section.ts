import type { OwnerLocale } from '@zapbip/types';

export type InstallSectionInput = {
  connectionLink: string;
  locale: OwnerLocale;
  standbyAgent: string | null;
};

export type InstallSection = (input: InstallSectionInput) => string;
