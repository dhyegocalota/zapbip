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

  it('lists each language page once', () => {
    expect(sitemapOf().match(/<loc>/g)).toHaveLength(2);
    expect(sitemapOf()).toContain('<loc>https://zapbip.com/</loc>');
    expect(sitemapOf()).toContain('<loc>https://zapbip.com/pt-br</loc>');
  });

  it('lists both locales and the default as alternates of each page', () => {
    expect(sitemapOf().match(/hreflang="en" href="https:\/\/zapbip.com\/"/g)).toHaveLength(2);
    expect(sitemapOf().match(/hreflang="pt-BR" href="https:\/\/zapbip.com\/pt-br"/g)).toHaveLength(2);
    expect(sitemapOf().match(/hreflang="x-default" href="https:\/\/zapbip.com\/"/g)).toHaveLength(2);
  });

  it('is well formed xml with the xhtml namespace', () => {
    expect(sitemapOf().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemapOf()).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});
