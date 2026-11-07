import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const INSTALL_CODE_PREFIX = 'zb_inst_';
export const INSTALL_CODE_RANDOM_BYTES = 16;
export const INSTALL_CODE_TTL_MS = 30 * MINUTE_MS;
export const INSTALL_PAGE_PATH_PREFIX = '/i/';
export const CLIENT_NAME_MAX_CHARS = 128;
export const INITIALIZE_BODY_MAX_BYTES = 4_096;
export const INSTALL_PAGE_REQUESTS_PER_MINUTE = 30;
export const CODEX_TOOL_TIMEOUT_SECONDS = 900;
export const CHATGPT_POLL_INTERVAL_MINUTES = 60;
export const HEARTBEAT_POLL_INTERVAL_MINUTES = 1;
export const INSTALL_SELF_TEST_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: '✅ instalado',
  [OwnerLocale.EnglishUs]: '✅ installed',
};
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
export const ZAPBIP_NPM_VERSION = '0.1.0';
