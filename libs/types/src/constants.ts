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
export const BYTES_PER_KILOBYTE = 1_000;
export const COMPANY_FACT_UNSET = 'COMPANY_FACT_UNSET';

export type CompanyFacts = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  address: string;
  website: string;
  contactEmail: string;
};

export const COMPANY = {
  tradeName: 'Logic Bit',
  legalName: 'Dhyego Fernando Rissao Calota',
  cnpj: '32.555.315/0001-91',
  address: 'R. Rio Grande do Norte, 1435, Sala 708, Savassi, Belo Horizonte – MG, 30130-138, Brasil',
  website: 'https://logicbit.com.br',
  contactEmail: 'dhyego@logicbit.com.br',
} as const;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const PAGE_LANGUAGE_FOLDER = 'pt-br';
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
export const OFFICIAL_NUMBER_UNSET = 'OFFICIAL_NUMBER_UNSET';
export const OFFICIAL_WHATSAPP_NUMBER: string = OFFICIAL_NUMBER_UNSET;
export const PRODUCTION_ZONE = 'zapbip.com';
export const PRODUCTION_PUBLIC_ORIGIN = `https://mcp.${PRODUCTION_ZONE}`;
export const CLOUDFLARE_NAMESERVER_SUFFIX = '.ns.cloudflare.com';
export const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
export const ZAPBIP_NPM_VERSION = '0.1.0';
export const OPENCLAW_PLUGIN_NPM_VERSION = '0.1.0';
export const ZAPBIP_PYPI_VERSION = '0.1.0';
export const SEEN_MESSAGE_LIMIT = 1_024;
