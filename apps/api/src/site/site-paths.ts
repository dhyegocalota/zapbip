import type { OwnerLocale } from '@zapbip/types';

export enum SitePath {
  Home = '/',
  Join = '/join',
  Locale = '/locale',
  Theme = '/theme',
  Robots = '/robots.txt',
  Sitemap = '/sitemap.xml',
  Favicon = '/favicon.svg',
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

export function siteAssetOf(input: { kind: SiteAssetKind; locale: OwnerLocale }): string {
  return `${SitePath.AssetPrefix}${input.kind.replace(LOCALE_PLACEHOLDER, input.locale)}`;
}

export const DOCS_ORIGIN = 'https://docs.zapbip.com';
