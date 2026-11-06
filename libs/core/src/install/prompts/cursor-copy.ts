import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const CURSOR_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('CURSOR_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('CURSOR_COPY is not implemented');
  },
};
