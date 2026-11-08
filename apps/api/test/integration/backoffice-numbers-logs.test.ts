import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { FakeGraph } from '../support/fake-graph';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_TEST_KEY, CLIENT_ADDRESS } from './backoffice-auth-fixtures';
import {
  ACCESS_TOKEN,
  APP_SECRET,
  DISPLAY_NUMBER,
  endBackofficeSession,
  numberIdOf,
  PHONE_NUMBER_ID,
  postAction,
  REGISTER_PATH,
  registrationFields,
  startBackofficeSession,
  WABA_ID,
} from './backoffice-numbers-fixtures';

const ROTATED_ACCESS_TOKEN = 'rotated-access-token-ta2';
const ROTATED_APP_SECRET = 'rotated-app-secret-sx2';
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
  test('pin: a registration, a verification, two rotations and a state change log no credential, number identifier or client address', async () => {
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
    const registered = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}) });
    const numberId = numberIdOf({ response: registered });
    const metaAppRow = await testEnv.CONNECTIONS.prepare('SELECT meta_app_ref AS metaAppRef FROM whatsapp_numbers WHERE id = ?')
      .bind(numberId)
      .first<{ metaAppRef: string }>();
    if (metaAppRow === null) throw new Error('the number has no Meta app');
    await postAction({ path: `/numbers/${numberId}/verify`, sessionToken, fields: {} });
    await postAction({
      path: `/numbers/${numberId}/access-token`,
      sessionToken,
      fields: { [NumberFormField.AccessToken]: ROTATED_ACCESS_TOKEN },
    });
    await postAction({
      path: `/meta-apps/${metaAppRow.metaAppRef}/app-secret`,
      sessionToken,
      fields: { [NumberFormField.AppSecret]: ROTATED_APP_SECRET, [NumberFormField.NumberId]: numberId },
    });
    await postAction({ path: `/numbers/${numberId}/state`, sessionToken, fields: { [NumberFormField.State]: WhatsAppNumberState.Active } });
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged.length).toBeGreaterThan(0);
    [
      BACKOFFICE_TEST_KEY,
      ACCESS_TOKEN,
      APP_SECRET,
      ROTATED_ACCESS_TOKEN,
      ROTATED_APP_SECRET,
      DISPLAY_NUMBER,
      DISPLAY_NUMBER.slice(1),
      PHONE_NUMBER_ID,
      WABA_ID,
      CLIENT_ADDRESS,
    ].forEach((secret) => expect(logged).not.toContain(secret));
  });
});
