import { DocsPageLanguage, OwnerLocale, PricingCurrency } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const PERCENT_MULTIPLIER = 100;
export const INSTALL_CODE_PREFIX = 'zb_inst_';
export const INSTALL_CODE_RANDOM_BYTES = 16;
export const INSTALL_CODE_TTL_MS = 30 * MINUTE_MS;
export const INSTALL_PAGE_PATH_PREFIX = '/i/';
export const CLIENT_APP_SIGN_IN_PATH_PREFIX = '/sign-in/';
export const CLIENT_APP_LOCALE_PATH_PREFIXES: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: '',
  [OwnerLocale.PortugueseBrazil]: '/pt-br',
  [OwnerLocale.Spanish]: '/es',
  [OwnerLocale.German]: '/de',
  [OwnerLocale.French]: '/fr',
  [OwnerLocale.Japanese]: '/ja',
  [OwnerLocale.Korean]: '/ko',
  [OwnerLocale.ChineseSimplified]: '/zh',
};
export const CLIENT_APP_LOGIN_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: 'login',
  [OwnerLocale.PortugueseBrazil]: 'entrar',
  [OwnerLocale.Spanish]: 'acceder',
  [OwnerLocale.German]: 'anmelden',
  [OwnerLocale.French]: 'connexion',
  [OwnerLocale.Japanese]: 'ログイン',
  [OwnerLocale.Korean]: '로그인',
  [OwnerLocale.ChineseSimplified]: '登录',
};
export const CLIENT_APP_TOKEN_BYTES = 32;
export const CLIENT_APP_TOKEN_LENGTH = 43;
export const SIGN_IN_LINK_TTL_MS = 10 * MINUTE_MS;
export const CLIENT_APP_SESSION_TTL_MS = 30 * DAY_MS;
export const CLIENT_NAME_MAX_CHARS = 128;
export const INITIALIZE_BODY_MAX_BYTES = 4_096;
export const INSTALL_PAGE_REQUESTS_PER_MINUTE = 30;
export const HEARTBEAT_POLL_INTERVAL_MINUTES = 1;
export const INSTALL_SELF_TEST_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: '✅ installed',
  [OwnerLocale.PortugueseBrazil]: '✅ instalado',
  [OwnerLocale.Spanish]: '✅ listo',
  [OwnerLocale.German]: '✅ installiert',
  [OwnerLocale.French]: '✅ installé',
  [OwnerLocale.Japanese]: '✅ インストール完了',
  [OwnerLocale.Korean]: '✅ 설치 완료',
  [OwnerLocale.ChineseSimplified]: '✅ 安装完成',
};
export const BYTES_PER_KILOBYTE = 1_000;
export const COMPANY_FACT_UNSET = 'COMPANY_FACT_UNSET';
export const META_APP_ID = '714836811568009';
export const META_APP_LABEL = 'zapbip';
export const META_LOGIN_CONFIGURATION_ID = '946808808378298';
export const ONBOARDING_PIN_LENGTH = 6;
export const ONBOARDING_PIN_PATTERN = new RegExp(`^\\d{${ONBOARDING_PIN_LENGTH}}$`);

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
  legalName: 'Logic Bit AI Software Boutique Ltda',
  cnpj: '32.555.315/0001-91',
  address: 'R. Rio Grande do Norte, 1435, Sala 708, Savassi, Belo Horizonte – MG, 30130-138, Brasil',
  website: 'https://logicbit.com.br',
  contactEmail: 'support@zapbip.com',
} as const;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const DOCS_LANGUAGE_FOLDERS: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: '',
  [DocsPageLanguage.PortugueseBrazil]: 'pt-br',
  [DocsPageLanguage.Spanish]: 'es',
  [DocsPageLanguage.German]: 'de',
  [DocsPageLanguage.French]: 'fr',
  [DocsPageLanguage.Japanese]: 'ja',
  [DocsPageLanguage.Korean]: 'ko',
  [DocsPageLanguage.Chinese]: 'zh',
};
export const DOCS_OWNER_LOCALES: Record<DocsPageLanguage, OwnerLocale> = {
  [DocsPageLanguage.English]: OwnerLocale.EnglishUs,
  [DocsPageLanguage.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
  [DocsPageLanguage.Spanish]: OwnerLocale.Spanish,
  [DocsPageLanguage.German]: OwnerLocale.German,
  [DocsPageLanguage.French]: OwnerLocale.French,
  [DocsPageLanguage.Japanese]: OwnerLocale.Japanese,
  [DocsPageLanguage.Korean]: OwnerLocale.Korean,
  [DocsPageLanguage.Chinese]: OwnerLocale.ChineseSimplified,
};
export const OWNER_LOCALE_BY_CALLING_CODE: Record<string, OwnerLocale> = {
  '55': OwnerLocale.PortugueseBrazil,
  '351': OwnerLocale.PortugueseBrazil,
  '34': OwnerLocale.Spanish,
  '52': OwnerLocale.Spanish,
  '54': OwnerLocale.Spanish,
  '56': OwnerLocale.Spanish,
  '57': OwnerLocale.Spanish,
  '58': OwnerLocale.Spanish,
  '51': OwnerLocale.Spanish,
  '53': OwnerLocale.Spanish,
  '591': OwnerLocale.Spanish,
  '593': OwnerLocale.Spanish,
  '595': OwnerLocale.Spanish,
  '598': OwnerLocale.Spanish,
  '502': OwnerLocale.Spanish,
  '503': OwnerLocale.Spanish,
  '504': OwnerLocale.Spanish,
  '505': OwnerLocale.Spanish,
  '506': OwnerLocale.Spanish,
  '507': OwnerLocale.Spanish,
  '49': OwnerLocale.German,
  '43': OwnerLocale.German,
  '41': OwnerLocale.German,
  '423': OwnerLocale.German,
  '33': OwnerLocale.French,
  '32': OwnerLocale.French,
  '352': OwnerLocale.French,
  '377': OwnerLocale.French,
  '81': OwnerLocale.Japanese,
  '82': OwnerLocale.Korean,
  '86': OwnerLocale.ChineseSimplified,
};
export const DOCS_LANGUAGE_OF_OWNER_LOCALE: Record<OwnerLocale, DocsPageLanguage> = {
  [OwnerLocale.EnglishUs]: DocsPageLanguage.English,
  [OwnerLocale.PortugueseBrazil]: DocsPageLanguage.PortugueseBrazil,
  [OwnerLocale.Spanish]: DocsPageLanguage.Spanish,
  [OwnerLocale.German]: DocsPageLanguage.German,
  [OwnerLocale.French]: DocsPageLanguage.French,
  [OwnerLocale.Japanese]: DocsPageLanguage.Japanese,
  [OwnerLocale.Korean]: DocsPageLanguage.Korean,
  [OwnerLocale.ChineseSimplified]: DocsPageLanguage.Chinese,
};
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
export const PRODUCTION_ZONE = 'zapbip.com';
export const PRODUCTION_PUBLIC_ORIGIN = `https://mcp.${PRODUCTION_ZONE}`;
export const START_LINK_PATH = '/start';
export const START_LINK = `${PRODUCTION_PUBLIC_ORIGIN}${START_LINK_PATH}`;
export const START_LINK_LANGUAGE_PARAMETER = 'lang';
export const SITE_ORIGIN = `https://${PRODUCTION_ZONE}`;
export const DOCS_ORIGIN = `https://docs.${PRODUCTION_ZONE}`;
export const ONBOARDING_SETUP_LINKS: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: `${DOCS_ORIGIN}/get-started/how-to-start`,
  [OwnerLocale.PortugueseBrazil]: `${DOCS_ORIGIN}/pt-br/get-started/how-to-start`,
  [OwnerLocale.Spanish]: `${DOCS_ORIGIN}/es/get-started/how-to-start`,
  [OwnerLocale.German]: `${DOCS_ORIGIN}/de/get-started/how-to-start`,
  [OwnerLocale.French]: `${DOCS_ORIGIN}/fr/get-started/how-to-start`,
  [OwnerLocale.Japanese]: `${DOCS_ORIGIN}/ja/get-started/how-to-start`,
  [OwnerLocale.Korean]: `${DOCS_ORIGIN}/ko/get-started/how-to-start`,
  [OwnerLocale.ChineseSimplified]: `${DOCS_ORIGIN}/zh/get-started/how-to-start`,
};
export const ONBOARDING_REQUEST_ACCESS_LINKS: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: SITE_ORIGIN,
  [OwnerLocale.PortugueseBrazil]: `${SITE_ORIGIN}/pt-br`,
  [OwnerLocale.Spanish]: `${SITE_ORIGIN}/es`,
  [OwnerLocale.German]: `${SITE_ORIGIN}/de`,
  [OwnerLocale.French]: `${SITE_ORIGIN}/fr`,
  [OwnerLocale.Japanese]: `${SITE_ORIGIN}/ja`,
  [OwnerLocale.Korean]: `${SITE_ORIGIN}/ko`,
  [OwnerLocale.ChineseSimplified]: `${SITE_ORIGIN}/zh`,
};
export const WHATSAPP_LINK_ORIGIN = 'https://wa.me';
export const WHATSAPP_LINK_TEXT_PARAMETER = 'text';
export const START_PREFILLED_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: 'Hi! I want to connect my AI agents to zapbip.',
  [OwnerLocale.PortugueseBrazil]: 'Oi! Quero conectar meus agentes de IA ao zapbip.',
  [OwnerLocale.Spanish]: '¡Hola! Quiero conectar mis agentes de IA a zapbip.',
  [OwnerLocale.German]: 'Hallo! Ich möchte meine KI-Agenten mit zapbip verbinden.',
  [OwnerLocale.French]: 'Bonjour\u202f! Je veux connecter mes agents IA à zapbip.',
  [OwnerLocale.Japanese]: 'こんにちは！AIエージェントをzapbipにつなぎたいです。',
  [OwnerLocale.Korean]: '안녕하세요! 제 AI 에이전트를 zapbip에 연결하고 싶어요.',
  [OwnerLocale.ChineseSimplified]: '你好！我想把我的 AI 智能体连接到 zapbip。',
};
export const CLOUDFLARE_NAMESERVER_SUFFIX = '.ns.cloudflare.com';
export const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
export const ZAPBIP_NPM_VERSION = '0.1.0';
export const INSTALL_PRODUCT_TEXT_MAX_LENGTH = 120;
export const PACKAGE_PATH_PREFIX = '/pkg/';
export const PRODUCTION_PACKAGES_BUCKET = 'zapbip-packages';
export const SEEN_MESSAGE_LIMIT = 1_024;
export const DISPLAY_NUMBER_PATTERN = /^\+\d{7,15}$/;
export const WAITLIST_REFERRAL_CODE_LENGTH = 12;
export const WAITLIST_REFERRAL_CODE_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz';
export const WAITLIST_EMAIL_MAX_LENGTH = 254;
export const DEFAULT_WAITLIST_REFERRAL_CAP = 5;
export const WAITLIST_REFERRAL_CAP_MIN = 1;
export const WAITLIST_REFERRAL_CAP_MAX = 100;
export const ACCESS_BATCH_LIMIT = 10;
export const WAITLIST_INVITE_TTL_MS = 30 * DAY_MS;
export const TURNSTILE_ACTION_WAITLIST_JOIN = 'waitlist-join';

export const PRICING_FREE_MESSAGES = 5;
export const PRICING_FREE_CENTS = 0;
export const PRICING_PRO_INCLUDED_MESSAGES = 1000;
export const PRICING_OVERAGE_BLOCK_MESSAGES = 1000;
export const PRICING_PRO_MONTHLY_CENTS: Record<PricingCurrency, number> = {
  [PricingCurrency.Usd]: 900,
  [PricingCurrency.Brl]: 4900,
};
export const PRICING_OVERAGE_CENTS: Record<PricingCurrency, number> = {
  [PricingCurrency.Usd]: 500,
  [PricingCurrency.Brl]: 2500,
};
export const PRICING_CURRENCY_BY_LOCALE: Record<OwnerLocale, PricingCurrency> = {
  [OwnerLocale.EnglishUs]: PricingCurrency.Usd,
  [OwnerLocale.PortugueseBrazil]: PricingCurrency.Brl,
  [OwnerLocale.Spanish]: PricingCurrency.Usd,
  [OwnerLocale.German]: PricingCurrency.Usd,
  [OwnerLocale.French]: PricingCurrency.Usd,
  [OwnerLocale.Japanese]: PricingCurrency.Usd,
  [OwnerLocale.Korean]: PricingCurrency.Usd,
  [OwnerLocale.ChineseSimplified]: PricingCurrency.Usd,
};
