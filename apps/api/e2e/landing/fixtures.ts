import { randomInt } from 'node:crypto';
import { expect, test as base, type APIRequestContext } from '@playwright/test';
import { OwnerLocale } from '@zapbip/types';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import { LandingVariable, landingValue } from './support/landing-environment';
import { resetWaitlist } from './support/landing-database';

const OCTET_LIMIT = 256;
const ADDRESS_OCTET_COUNT = 3;
const ADDRESS_PREFIX = '10';
const WIDGET_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

type LandingFixtures = {
  baseURL: string;
  cleanWaitlist: void;
  network: { address: () => string };
};

function randomAddress(): string {
  return [ADDRESS_PREFIX, ...Array.from({ length: ADDRESS_OCTET_COUNT }, () => String(randomInt(OCTET_LIMIT)))].join('.');
}

export const test = base.extend<LandingFixtures>({
  baseURL: async ({}, use) => use(landingValue({ variable: LandingVariable.SiteOrigin })),
  cleanWaitlist: [
    async ({}, use) => {
      resetWaitlist();
      await use();
    },
    { auto: true },
  ],
  network: [
    async ({ page }, use) => {
      const currentAddress = randomAddress();
      const ownOrigins = [
        landingValue({ variable: LandingVariable.SiteOrigin }),
        landingValue({ variable: LandingVariable.BackofficeOrigin }),
      ];
      await page.route('**/*', async (route) => {
        const isOwnRequest = ownOrigins.some((origin) => route.request().url().startsWith(origin));
        if (!isOwnRequest) return route.continue();
        return route.continue({ headers: { ...(await route.request().allHeaders()), [CLIENT_ADDRESS_HEADER]: currentAddress } });
      });
      await use({ address: () => currentAddress });
    },
    { auto: true },
  ],
});

export async function joinThroughApi(input: { request: APIRequestContext; email: string; referralCode?: string }): Promise<string> {
  const { request, email, referralCode } = input;
  const response = await request.post('/join', {
    headers: { [CLIENT_ADDRESS_HEADER]: randomAddress() },
    form: {
      email,
      locale: OwnerLocale.EnglishUs,
      'cf-turnstile-response': WIDGET_TEST_TOKEN,
      ...(referralCode === undefined ? {} : { referralCode }),
    },
  });
  return response.text();
}

export { expect };
