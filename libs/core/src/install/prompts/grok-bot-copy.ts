import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const GROK_BOT_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('GROK_BOT_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('GROK_BOT_COPY is not implemented');
  },
};
