import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { formatCount } from '../../src/site/price-format';
import { repositoryStarsOf } from '../../src/site/repository-stars';
import { REPOSITORY_SELF_HOSTING_URL, REPOSITORY_URL } from '../../src/site/site-constants';
import { renderSiteCopy, SiteCopyKey } from '../../src/site/site-copy';
import { localePathOf } from '../../src/site/site-language';
import { markdownPathOf } from '../../src/site/agentic-paths';
import { copyHtml, siteFetch } from '../support/site';

const STAR_COUNT = 1234;
const HEADER_PATTERN = /<header class="site-header">[\s\S]*?<\/header>/;
const HERO_PATTERN = /<section class="hero"[\s\S]*?<\/section>/;
const PRICING_PATTERN = /<section class="block" id="pricing"[\s\S]*?<\/section>/;
const OPEN_SOURCE_PATTERN = /<section class="block" id="open-source"[\s\S]*?<\/section>/;
const FOOTER_PATTERN = /<footer class="site-footer">[\s\S]*?<\/footer>/;
const STARS_PATTERN = /class="github-stars"/;

function gitHubAnswering(input: { body: unknown; status: number }): typeof fetch {
  return (async () => Response.json(input.body, { status: input.status })) as unknown as typeof fetch;
}

function unreachableGitHub(): typeof fetch {
  return (async () => {
    throw new TypeError('network down');
  }) as unknown as typeof fetch;
}

async function pageWithStars(input: { fetchImplementation: typeof fetch; path?: string }): Promise<string> {
  const { fetchImplementation, path = '/' } = input;
  const cache = await caches.open(crypto.randomUUID());
  const response = await siteFetch({ path, starCountOf: () => repositoryStarsOf({ fetchImplementation, cache }) });
  expect(response.status).toBe(200);
  return response.text();
}

function sectionOf(input: { html: string; pattern: RegExp }): string {
  const match = input.pattern.exec(input.html);
  if (match === null) throw new Error(`no match for ${input.pattern}`);
  return match[0];
}

describe('the GitHub button in the site header', () => {
  it('shows the compact star count fetched from GitHub and links the repository', async () => {
    const html = await pageWithStars({ fetchImplementation: gitHubAnswering({ body: { stargazers_count: STAR_COUNT }, status: 200 }) });
    const header = sectionOf({ html, pattern: HEADER_PATTERN });
    const label = copyHtml({
      key: SiteCopyKey.GitHubStarsLabel,
      locale: OwnerLocale.EnglishUs,
      values: { stars: formatCount({ count: STAR_COUNT, locale: OwnerLocale.EnglishUs }) },
    });
    expect(header).toContain(`href="${REPOSITORY_URL}"`);
    expect(header).toContain(`aria-label="${label}"`);
    expect(header).toMatch(/<span class="github-stars" aria-hidden="true">[^<]*1\.2K<\/span>/);
    expect(header).toMatch(/<svg class="github-mark"[^>]*aria-hidden="true"/);
  });

  it('writes the count in the number style of the page language', async () => {
    const html = await pageWithStars({
      fetchImplementation: gitHubAnswering({ body: { stargazers_count: STAR_COUNT }, status: 200 }),
      path: localePathOf({ locale: OwnerLocale.PortugueseBrazil }),
    });
    expect(sectionOf({ html, pattern: HEADER_PATTERN })).toMatch(/<span class="github-stars" aria-hidden="true">[^<]*1,2\smil<\/span>/);
  });

  it.each([
    ['GitHub is unreachable', unreachableGitHub()],
    ['GitHub refuses the request', gitHubAnswering({ body: { message: 'API rate limit exceeded' }, status: 403 })],
  ])('keeps the button without any number when %s', async (_case, fetchImplementation) => {
    const html = await pageWithStars({ fetchImplementation });
    const header = sectionOf({ html, pattern: HEADER_PATTERN });
    expect(header).toContain(`href="${REPOSITORY_URL}"`);
    expect(header).toContain(`aria-label="${copyHtml({ key: SiteCopyKey.GitHubLabel, locale: OwnerLocale.EnglishUs })}"`);
    expect(header).not.toMatch(STARS_PATTERN);
  });

  it('shows the button on the legal pages too', async () => {
    const html = await pageWithStars({
      fetchImplementation: gitHubAnswering({ body: { stargazers_count: STAR_COUNT }, status: 200 }),
      path: '/terms',
    });
    expect(sectionOf({ html, pattern: HEADER_PATTERN })).toContain(`href="${REPOSITORY_URL}"`);
  });
});

describe.each(Object.values(OwnerLocale))('the open source story in %s', (locale) => {
  const copy = (key: SiteCopyKey): string => copyHtml({ key, locale });

  async function pageOf(): Promise<string> {
    const response = await siteFetch({ path: localePathOf({ locale }) });
    return response.text();
  }

  it('puts an open source badge in the hero that links the repository', async () => {
    const hero = sectionOf({ html: await pageOf(), pattern: HERO_PATTERN });
    expect(hero).toMatch(new RegExp(`<a class="hero-source" href="${REPOSITORY_URL}"[^>]*>[\\s\\S]*?${copy(SiteCopyKey.HeroOpenSource)}`));
  });

  it('tells that the code is public and links the repository and the self-hosting guide', async () => {
    const section = sectionOf({ html: await pageOf(), pattern: OPEN_SOURCE_PATTERN });
    expect(section).toContain(copy(SiteCopyKey.OpenSourceTitle));
    expect(section).toContain(copy(SiteCopyKey.OpenSourceBody));
    expect(section).toContain(`href="${REPOSITORY_URL}"`);
    expect(section).toContain(`href="${REPOSITORY_SELF_HOSTING_URL}"`);
    expect(section).toContain(copy(SiteCopyKey.OpenSourceRepository));
    expect(section).toContain(copy(SiteCopyKey.OpenSourceSelfHosting));
  });

  it('labels the plans as zapbip Cloud, names the Brazilian number and links self-hosting', async () => {
    const pricing = sectionOf({ html: await pageOf(), pattern: PRICING_PATTERN });
    expect(pricing).toContain(copy(SiteCopyKey.PricingEyebrow));
    expect(pricing).toContain(copy(SiteCopyKey.PricingCloudNumber));
    expect(pricing).toContain(copy(SiteCopyKey.PricingSelfHost));
    expect(pricing).toContain(`href="${REPOSITORY_URL}"`);
  });

  it('answers whether zapbip is open source in the FAQ', async () => {
    const html = await pageOf();
    expect(html).toContain(`<summary>${copy(SiteCopyKey.FaqOpenSourceQuestion)}</summary>`);
    expect(html).toContain(copy(SiteCopyKey.FaqOpenSourceAnswer));
  });

  it('links GitHub and says open source under AGPL-3.0 in the footer', async () => {
    const footer = sectionOf({ html: await pageOf(), pattern: FOOTER_PATTERN });
    expect(footer).toContain(`href="${REPOSITORY_URL}"`);
    expect(footer).toContain(copy(SiteCopyKey.FooterGitHub));
    expect(footer).toContain(copy(SiteCopyKey.FooterOpenSource));
  });

  it('tells the same story in the Markdown twin, with the links', async () => {
    const markdown = await (await siteFetch({ path: markdownPathOf({ htmlPath: localePathOf({ locale }) }) })).text();
    const text = (key: SiteCopyKey): string => renderSiteCopy({ key, locale });
    expect(markdown).toContain(text(SiteCopyKey.PricingCloudNumber));
    expect(markdown).toContain(text(SiteCopyKey.OpenSourceBody));
    expect(markdown).toContain(`[${text(SiteCopyKey.OpenSourceRepository)}](${REPOSITORY_URL})`);
    expect(markdown).toContain(`[${text(SiteCopyKey.OpenSourceSelfHosting)}](${REPOSITORY_SELF_HOSTING_URL})`);
  });
});
