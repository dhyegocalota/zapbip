import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const PERCENT_MULTIPLIER = 100;
export const INSTALL_CODE_PREFIX = 'zb_inst_';
export const INSTALL_CODE_RANDOM_BYTES = 16;
export const INSTALL_CODE_TTL_MS = 30 * MINUTE_MS;
export const INSTALL_PAGE_PATH_PREFIX = '/i/';
export const CLIENT_NAME_MAX_CHARS = 128;
export const INITIALIZE_BODY_MAX_BYTES = 4_096;
export const INSTALL_PAGE_REQUESTS_PER_MINUTE = 30;
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
export const PRODUCTION_ZONE = 'zapbip.com';
export const PRODUCTION_PUBLIC_ORIGIN = `https://mcp.${PRODUCTION_ZONE}`;
export const START_LINK_PATH = '/start';
export const START_LINK = `${PRODUCTION_PUBLIC_ORIGIN}${START_LINK_PATH}`;
export const START_LINK_LANGUAGE_PARAMETER = 'lang';
export const WHATSAPP_LINK_ORIGIN = 'https://wa.me';
export const WHATSAPP_LINK_TEXT_PARAMETER = 'text';
export const START_PREFILLED_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'Oi! Quero conectar meus agentes de IA ao zapbip.',
  [OwnerLocale.EnglishUs]: 'Hi! I want to connect my AI agents to zapbip.',
};
export const CLOUDFLARE_NAMESERVER_SUFFIX = '.ns.cloudflare.com';
export const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
export const ZAPBIP_NPM_VERSION = '0.1.0';
export const INSTALL_PRODUCT_TEXT_MAX_LENGTH = 120;
export const PACKAGE_PATH_PREFIX = '/pkg/';
export const PRODUCTION_PACKAGES_BUCKET = 'zapbip-packages';
export const SEEN_MESSAGE_LIMIT = 1_024;
export const DISPLAY_NUMBER_PATTERN = /^\+\d{7,15}$/;
