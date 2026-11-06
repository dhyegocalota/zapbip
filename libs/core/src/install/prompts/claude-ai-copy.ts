import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const CLAUDE_AI_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('CLAUDE_AI_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('CLAUDE_AI_COPY is not implemented');
  },
};
