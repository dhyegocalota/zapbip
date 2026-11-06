import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
export const OFFICIAL_NUMBER_UNSET = 'OFFICIAL_NUMBER_UNSET';
export const OFFICIAL_WHATSAPP_NUMBER: string = OFFICIAL_NUMBER_UNSET;
export const ZAPBIP_NPM_VERSION = '0.1.0';
export const COMPANY_FACT_UNSET = 'COMPANY_FACT_UNSET';

export type CompanyFacts = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  address: string;
  website: string;
  contactEmail: string;
};

export const COMPANY: CompanyFacts = {
  legalName: COMPANY_FACT_UNSET,
  tradeName: 'Logic Bit',
  cnpj: COMPANY_FACT_UNSET,
  address: COMPANY_FACT_UNSET,
  website: COMPANY_FACT_UNSET,
  contactEmail: COMPANY_FACT_UNSET,
};
