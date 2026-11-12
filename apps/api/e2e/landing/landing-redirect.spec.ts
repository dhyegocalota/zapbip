import { expect, test } from './fixtures';
import { LandingVariable, landingValue } from './support/landing-environment';

const MOVED_PERMANENTLY = 301;
const NOT_FOUND = 404;

function wwwOrigin(): string {
  const siteUrl = new URL(landingValue({ variable: LandingVariable.SiteOrigin }));
  return `${siteUrl.protocol}//www.${siteUrl.host}`;
}

test('www redirects to the site with path and query', async ({ request }) => {
  const response = await request.get(`${wwwOrigin()}/?ref=abc`, { maxRedirects: 0 });
  expect(response.status()).toBe(MOVED_PERMANENTLY);
  expect(response.headers()['location']).toBe(`${landingValue({ variable: LandingVariable.SiteOrigin })}/?ref=abc`);
});

test('the site host does not serve the MCP routes', async ({ request }) => {
  expect((await request.get('/health')).status()).toBe(NOT_FOUND);
});
