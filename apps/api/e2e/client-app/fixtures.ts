import { randomInt } from 'node:crypto';
import { test as base } from '@playwright/test';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import { ClientAppVariable, clientAppValue } from './support/client-app-environment';

const OCTET_LIMIT = 256;
const ADDRESS_OCTET_COUNT = 3;
const ADDRESS_PREFIX = '10';

type ClientAppFixtures = {
  baseURL: string;
  network: { address: string };
};

function randomAddress(): string {
  return [ADDRESS_PREFIX, ...Array.from({ length: ADDRESS_OCTET_COUNT }, () => String(randomInt(OCTET_LIMIT)))].join('.');
}

export const test = base.extend<ClientAppFixtures>({
  baseURL: async ({}, use) => use(clientAppValue({ variable: ClientAppVariable.AppOrigin })),
  network: [
    async ({ page }, use) => {
      const address = randomAddress();
      const appOrigin = clientAppValue({ variable: ClientAppVariable.AppOrigin });
      await page.route('**/*', async (route) => {
        if (!route.request().url().startsWith(appOrigin)) return route.continue();
        return route.continue({ headers: { ...(await route.request().allHeaders()), [CLIENT_ADDRESS_HEADER]: address } });
      });
      await use({ address });
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
