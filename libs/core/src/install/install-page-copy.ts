import { OwnerLocale } from '@zapbip/types';

export const INSTALL_PAGE_COPY: Record<OwnerLocale, () => string> = {
  [OwnerLocale.PortugueseBrazil]: () => {
    throw new Error('INSTALL_PAGE_COPY is not implemented');
  },
  [OwnerLocale.EnglishUs]: () => {
    throw new Error('INSTALL_PAGE_COPY is not implemented');
  },
};
