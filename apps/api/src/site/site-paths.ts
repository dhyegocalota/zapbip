import { OwnerLocale } from '@zapbip/types';

export enum SitePath {
  Home = '/',
  PortugueseHome = '/pt-br',
  Terms = '/terms',
  Privacy = '/privacy',
  PortugueseTerms = '/pt-br/termos',
  PortuguesePrivacy = '/pt-br/privacidade',
  Join = '/join',
  Locale = '/locale',
  Theme = '/theme',
  Robots = '/robots.txt',
  Sitemap = '/sitemap.xml',
  Favicon = '/favicon.svg',
  LlmsText = '/llms.txt',
  LlmsFullText = '/llms-full.txt',
  Setup = '/setup.md',
  McpDiscovery = '/.well-known/mcp.json',
  McpServerCard = '/.well-known/mcp/server-card.json',
  AgentCard = '/.well-known/agent-card.json',
  SecurityText = '/.well-known/security.txt',
  RequestAccess = '/api/request-access',
  Pricing = '/api/pricing',
  QuickStart = '/api/quick-start',
  Stylesheet = '/site/site.css',
  Script = '/site/site.js',
  AssetPrefix = '/site/',
}

export enum SiteAssetKind {
  DemoMp4 = 'demo-{locale}-960.mp4',
  DemoWebm = 'demo-{locale}-960.webm',
  PosterLarge = 'demo-{locale}-poster-960.webp',
  PosterSmall = 'demo-{locale}-poster-540.webp',
  OpenGraphImage = 'og-{locale}.png',
}

export const APPLE_TOUCH_ICON_PATH = `${SitePath.AssetPrefix}apple-touch-icon.png`;
const LOCALE_PLACEHOLDER = '{locale}';
// NB ADR 0047: the demo exists in English and Portuguese only; every other language shows the English demo until it is recorded. The Open Graph image exists in every language.
const ASSET_LOCALES: Record<OwnerLocale, OwnerLocale> = {
  [OwnerLocale.EnglishUs]: OwnerLocale.EnglishUs,
  [OwnerLocale.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
  [OwnerLocale.Spanish]: OwnerLocale.EnglishUs,
  [OwnerLocale.German]: OwnerLocale.EnglishUs,
  [OwnerLocale.French]: OwnerLocale.EnglishUs,
  [OwnerLocale.Japanese]: OwnerLocale.EnglishUs,
  [OwnerLocale.Korean]: OwnerLocale.EnglishUs,
  [OwnerLocale.ChineseSimplified]: OwnerLocale.EnglishUs,
};

export function siteAssetOf(input: { kind: SiteAssetKind; locale: OwnerLocale }): string {
  const assetLocale = input.kind === SiteAssetKind.OpenGraphImage ? input.locale : ASSET_LOCALES[input.locale];
  return `${SitePath.AssetPrefix}${input.kind.replace(LOCALE_PLACEHOLDER, assetLocale)}`;
}

const LOGO_FOLDER = 'logos/';

export function logoPathOf(input: { id: string }): string {
  return `${SitePath.AssetPrefix}${LOGO_FOLDER}${input.id}.svg`;
}

export const DOCS_ORIGIN = 'https://docs.zapbip.com';
