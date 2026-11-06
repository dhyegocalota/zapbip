import { OwnerLocale } from '@zapbip/types';

export type InstallPageTexts = {
  ownerLanguage: string;
  unsupportedProduct: string;
  expired: string;
  notFound: string;
};

export const INSTALL_PAGE_COPY: Record<OwnerLocale, InstallPageTexts> = {
  [OwnerLocale.PortugueseBrazil]: { ownerLanguage: '', unsupportedProduct: '', expired: '', notFound: '' },
  [OwnerLocale.EnglishUs]: { ownerLanguage: '', unsupportedProduct: '', expired: '', notFound: '' },
};
