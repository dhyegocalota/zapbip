import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { FakeGraph } from '../support/fake-graph';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_TEST_PASSWORD, CLIENT_ADDRESS } from './backoffice-auth-fixtures';
import {
  ACCESS_TOKEN,
  DISPLAY_NUMBER,
  endBackofficeSession,
  PHONE_NUMBER_ID,
  postAction,
  startBackofficeSession,
  WABA_ID,
} from './backoffice-numbers-fixtures';

const ROTATED_ACCESS_TOKEN = 'rotated-access-token-ta2';
const NUMBER_ID = 'num_logs';
const fakeGraph = new FakeGraph({
  baseUrl: readWhatsAppEnvironment({ env: testEnv }).graphBaseUrl,
  resourceIds: [PHONE_NUMBER_ID, WABA_ID],
});

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await fakeGraph.reset();
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('logs of the numbers pages', () => {
  test('pin: a verification, a token rotation and a state change log no credential, number identifier or client address', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    await fakeGraph.respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}`,
      status: 200,
      body: { display_phone_number: DISPLAY_NUMBER, verified_name: 'Logic Bit', quality_rating: 'GREEN' },
    });
    await fakeGraph.respondWith({
      method: 'GET',
      path: `/${GRAPH_API_VERSION}/${WABA_ID}/message_templates`,
      status: 200,
      body: { data: [] },
    });
    await seedWhatsAppNumber({
      numberId: NUMBER_ID,
      phoneNumberId: PHONE_NUMBER_ID,
      wabaId: WABA_ID,
      displayNumber: DISPLAY_NUMBER,
      accessToken: ACCESS_TOKEN,
      state: WhatsAppNumberState.Pending,
    });
    await postAction({ path: `/numbers/${NUMBER_ID}/verify`, sessionToken, fields: {} });
    await postAction({
      path: `/numbers/${NUMBER_ID}/access-token`,
      sessionToken,
      fields: { [NumberFormField.AccessToken]: ROTATED_ACCESS_TOKEN },
    });
    await postAction({
      path: `/numbers/${NUMBER_ID}/state`,
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Active },
    });
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged.length).toBeGreaterThan(0);
    [
      BACKOFFICE_TEST_PASSWORD,
      ACCESS_TOKEN,
      ROTATED_ACCESS_TOKEN,
      DISPLAY_NUMBER,
      DISPLAY_NUMBER.slice(1),
      PHONE_NUMBER_ID,
      WABA_ID,
      CLIENT_ADDRESS,
    ].forEach((secret) => expect(logged).not.toContain(secret));
  });
});
