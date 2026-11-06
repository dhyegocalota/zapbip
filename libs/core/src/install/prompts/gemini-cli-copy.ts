import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const GEMINI_CLI_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('GEMINI_CLI_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('GEMINI_CLI_COPY is not implemented');
  },
};
