import { OwnerLocale } from '@zapbip/types';

const COMPANY_TRADE_NAME = 'Logic Bit';

export type InstallPageTexts = {
  ownerLanguage: string;
  unsupportedProduct: string;
  expired: string;
  notFound: string;
  footer: string;
};

export const INSTALL_PAGE_COPY: Record<OwnerLocale, InstallPageTexts> = {
  [OwnerLocale.PortugueseBrazil]: {
    ownerLanguage: 'Brazilian Portuguese',
    unsupportedProduct: 'O zapbip ainda não conhece este produto. Não consegui instalar.',
    expired: 'Este link expirou ou já foi usado. Peça um novo ao zapbip no WhatsApp: envie `girar <nome>`.',
    notFound: 'Não encontrado.',
    footer: `zapbip é um produto da ${COMPANY_TRADE_NAME}`,
  },
  [OwnerLocale.EnglishUs]: {
    ownerLanguage: 'US English',
    unsupportedProduct: 'zapbip does not know this product yet. I could not install it.',
    expired: 'This link has expired or was already used. Ask zapbip on WhatsApp for a new one: send `rotate <name>`.',
    notFound: 'Not found.',
    footer: `zapbip is a product of ${COMPANY_TRADE_NAME}`,
  },
};
