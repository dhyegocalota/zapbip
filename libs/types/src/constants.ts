import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const BYTES_PER_KILOBYTE = 1_000;
export const COMPANY_FACT_UNSET = 'COMPANY_FACT_UNSET';
export const COMPANY = {
  tradeName: 'Logic Bit',
  legalName: COMPANY_FACT_UNSET,
  cnpj: COMPANY_FACT_UNSET,
  address: COMPANY_FACT_UNSET,
  website: COMPANY_FACT_UNSET,
  contactEmail: COMPANY_FACT_UNSET,
} as const;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
