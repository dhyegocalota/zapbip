import { OwnerLocale } from '@zapbip/types';

export type StartLinkTexts = {
  htmlLanguage: string;
  unavailableTitle: string;
  unavailableBody: string;
};

export const START_LINK_COPY: Record<OwnerLocale, StartLinkTexts> = {
  [OwnerLocale.PortugueseBrazil]: {
    htmlLanguage: 'pt-BR',
    unavailableTitle: 'zapbip: voltamos já',
    unavailableBody: 'No momento não há um número do zapbip aceitando novos donos. Tente de novo em alguns minutos.',
  },
  [OwnerLocale.EnglishUs]: {
    htmlLanguage: 'en-US',
    unavailableTitle: 'zapbip: back soon',
    unavailableBody: 'No zapbip number is accepting new owners right now. Please try again in a few minutes.',
  },
};
