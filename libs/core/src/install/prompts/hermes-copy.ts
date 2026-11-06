import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const HERMES_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('HERMES_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('HERMES_COPY is not implemented');
  },
};
