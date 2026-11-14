import { describe, expect, it } from 'vitest';
import { renderRobots, renderSitemap } from '../../src/site/robots-and-sitemap';

const ORIGIN = 'https://zapbip.com';

describe('robots.txt', () => {
  it('allows everything and points at the sitemap', () => {
    const robots = renderRobots({ origin: ORIGIN });
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://zapbip.com/sitemap.xml');
  });
});

describe('sitemap.xml', () => {
  const sitemapOf = (): string => renderSitemap({ origin: ORIGIN });
  const PAGE_PATHS = [
    '/',
    '/pt-br',
    '/es',
    '/de',
    '/fr',
    '/ja',
    '/ko',
    '/zh',
    '/terms',
    '/pt-br/termos',
    '/es/terms',
    '/de/terms',
    '/fr/terms',
    '/ja/terms',
    '/ko/terms',
    '/zh/terms',
    '/privacy',
    '/pt-br/privacidade',
    '/es/privacy',
    '/de/privacy',
    '/fr/privacy',
    '/ja/privacy',
    '/ko/privacy',
    '/zh/privacy',
  ];
  const HREFLANGS = ['en', 'pt-BR', 'es', 'de', 'fr', 'ja', 'ko', 'zh-CN'];

  it('lists each language page and each legal page once', () => {
    expect(sitemapOf().match(/<loc>/g)).toHaveLength(PAGE_PATHS.length);
    PAGE_PATHS.forEach((path) => expect(sitemapOf().match(new RegExp(`<loc>https://zapbip.com${path}</loc>`, 'g'))).toHaveLength(1));
  });

  it('lists the eight languages and the default as alternates of each page', () => {
    HREFLANGS.forEach((hreflang) =>
      expect(sitemapOf().match(new RegExp(`hreflang="${hreflang}" href=`, 'g'))).toHaveLength(PAGE_PATHS.length),
    );
    expect(sitemapOf().match(/hreflang="x-default" href="https:\/\/zapbip.com\/"/g)).toHaveLength(HREFLANGS.length);
    expect(sitemapOf().match(/hreflang="zh-CN" href="https:\/\/zapbip.com\/zh"/g)).toHaveLength(HREFLANGS.length);
  });

  it('is well formed xml with the xhtml namespace', () => {
    expect(sitemapOf().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemapOf()).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});
