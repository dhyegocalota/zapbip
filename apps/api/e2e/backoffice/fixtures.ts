import { randomInt } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import { CLIENT_ADDRESS_HEADER } from '../../src/backoffice/backoffice-constants';
import { FakeGraph } from '../../test/support/fake-graph';
import { clearRegistry } from './support/operator-database';
import { WalkVariable, walkValue } from './support/walk-environment';

const OCTET_LIMIT = 256;
const ADDRESS_OCTET_COUNT = 3;
const ADDRESS_PREFIX = '10';
const REPORTED_CONSOLE_TYPES = ['error', 'warning'];
const FAILED_LOAD_PREFIX = 'Failed to load resource';
const DOCUMENT_RESOURCE_TYPE = 'document';
const FIRST_ERROR_STATUS = 400;

export type ClientNetwork = { address: () => string; rotateAddress: () => void };

type WalkFixtures = {
  baseURL: string;
  network: ClientNetwork;
  fakeGraph: FakeGraph;
  pageProblems: string[];
  cleanRegistry: void;
};

function randomAddress(): string {
  return [ADDRESS_PREFIX, ...Array.from({ length: ADDRESS_OCTET_COUNT }, () => String(randomInt(OCTET_LIMIT)))].join('.');
}

export const test = base.extend<WalkFixtures>({
  baseURL: async ({}, use) => use(walkValue({ variable: WalkVariable.Origin })),
  network: [
    async ({ page }, use) => {
      let currentAddress = randomAddress();
      await page.route('**/*', async (route) =>
        route.continue({ headers: { ...(await route.request().allHeaders()), [CLIENT_ADDRESS_HEADER]: currentAddress } }),
      );
      await use({
        address: () => currentAddress,
        rotateAddress: () => {
          currentAddress = randomAddress();
        },
      });
    },
    { auto: true },
  ],
  cleanRegistry: [
    async ({}, use) => {
      clearRegistry();
      await use();
    },
    { auto: true },
  ],
  fakeGraph: async ({}, use) => {
    const fakeGraph = new FakeGraph({ baseUrl: walkValue({ variable: WalkVariable.GraphBaseUrl }) });
    await fakeGraph.reset();
    await use(fakeGraph);
  },
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      const failedLoads: string[] = [];
      let failedDocumentCount = 0;
      page.on('console', (message) => {
        if (!REPORTED_CONSOLE_TYPES.includes(message.type())) return;
        const target = message.text().startsWith(FAILED_LOAD_PREFIX) ? failedLoads : problems;
        target.push(`console ${message.type()}: ${message.text()}`);
      });
      page.on('response', (response) => {
        const isFailedDocument = response.request().resourceType() === DOCUMENT_RESOURCE_TYPE && response.status() >= FIRST_ERROR_STATUS;
        if (isFailedDocument) failedDocumentCount += 1;
      });
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()} ${request.failure()?.errorText}`));
      await use(problems);
      expect([...problems, ...failedLoads.slice(failedDocumentCount)]).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
