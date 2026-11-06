import { OwnerLocale } from '@zapbip/types';
import type { InstallSectionInput } from './install-section';

export const CLAUDE_CODE_COPY: Record<OwnerLocale, (input: InstallSectionInput) => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('CLAUDE_CODE_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('CLAUDE_CODE_COPY is not implemented');
  },
};

export const CLAUDE_CODE_SKILL_DESCRIPTION: Record<OwnerLocale, () => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('CLAUDE_CODE_SKILL_DESCRIPTION is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('CLAUDE_CODE_SKILL_DESCRIPTION is not implemented');
  },
};
