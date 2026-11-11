import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { CHECKED_VALUE, NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { readOperator } from './backoffice-auth-fixtures';
import {
  countRows,
  endBackofficeSession,
  getPage,
  postAction,
  refusingStepUpEnv,
  startBackofficeSession,
  stateOf,
  submitRejectedAction,
} from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;
const STATUS_TOO_MANY_REQUESTS = 429;
const CONNECT_PATH = '/numbers/connect';
const NEW_ACCESS_TOKEN = 'replacement-access-token-ta2';
const WRONG_CODE = '000000';
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];
const registry = numberRegistryOf({ bindings: testEnv });

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
});

afterEach(endBackofficeSession);

async function seedNumber(input: { suffix: string; label: string; state?: WhatsAppNumberState }): Promise<void> {
  await seedWhatsAppNumber({
    numberId: `num_${input.suffix}`,
    metaAppRef: `app_${input.suffix}`,
    phoneNumberId: `10000000${input.suffix}`,
    wabaId: `30000000${input.suffix}`,
    displayNumber: `55119000${input.suffix}`,
    accessToken: `token-${input.suffix}`,
    appSecret: `secret-${input.suffix}`,
    state: input.state,
  });
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET label = ? WHERE id = ?').bind(input.label, `num_${input.suffix}`).run();
}

describe('the numbers list', () => {
  test('shows the empty state and a link to register when there is no number', async () => {
    const response = await getPage({ path: '/numbers', sessionToken });
    const body = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(body).toContain(copy[BackofficeCopyKey.NumbersEmptyTitle]);
    expect(body).toContain(`href="${CONNECT_PATH}"`);
  });

  test('shows one row for one number and three rows sorted by label for three', async () => {
    await seedNumber({ suffix: '0001', label: 'Charlie' });
    const one = await (await getPage({ path: '/numbers', sessionToken })).text();
    expect(one.match(/class="number-row"/g)).toHaveLength(1);
    await seedNumber({ suffix: '0002', label: 'Alpha' });
    await seedNumber({ suffix: '0003', label: 'Bravo' });
    const three = await (await getPage({ path: '/numbers', sessionToken })).text();
    expect(three.match(/class="number-row"/g)).toHaveLength(3);
    expect(three.indexOf('Alpha')).toBeLessThan(three.indexOf('Bravo'));
    expect(three.indexOf('Bravo')).toBeLessThan(three.indexOf('Charlie'));
  });

  test('renders a label with markup escaped', async () => {
    await seedNumber({ suffix: '0004', label: '<script>alert(1)</script>' });
    const body = await (await getPage({ path: '/numbers', sessionToken })).text();
    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('answers 404 for a number that does not exist', async () => {
    const response = await getPage({ path: '/numbers/num_missing', sessionToken });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });
});

describe('the removed typed registration', () => {
  test('answers 404 for the register form', async () => {
    const response = await getPage({ path: '/numbers/new', sessionToken });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('answers 404 for the app secret route and keeps the number', async () => {
    await seedNumber({ suffix: '0005', label: 'First' });
    const response = await postAction({
      path: '/meta-apps/app_0005/app-secret',
      sessionToken,
      fields: { [NumberFormField.AppSecret]: 'replacement', [NumberFormField.NumberId]: 'num_0005' },
    });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('shows no Meta app column in the list', async () => {
    await seedNumber({ suffix: '0006', label: 'First' });
    const body = await (await getPage({ path: '/numbers', sessionToken })).text();
    expect(body).not.toContain(copy[BackofficeCopyKey.NumbersColumnMetaApp]);
  });

  test('shows no replace app secret block on the number page', async () => {
    await seedNumber({ suffix: '0016', label: 'First' });
    const body = await (await getPage({ path: '/numbers/num_0016', sessionToken })).text();
    expect(body).not.toContain(copy[BackofficeCopyKey.NumberRotateSecretTitle]);
    expect(body).not.toContain(copy[BackofficeCopyKey.NumberMetaApp]);
  });
});

describe('changing the state of a number', () => {
  async function verifiedPendingNumber(): Promise<string> {
    await seedNumber({ suffix: '0007', label: 'Pending', state: WhatsAppNumberState.Pending });
    return 'num_0007';
  }

  test('activates a verified pending number, closes it, disables it with a confirmation and closes it again', async () => {
    const numberId = await verifiedPendingNumber();
    const path = `/numbers/${numberId}/state`;
    const steps: { target: WhatsAppNumberState; fields: Record<string, string> }[] = [
      { target: WhatsAppNumberState.Active, fields: {} },
      { target: WhatsAppNumberState.Closed, fields: {} },
      { target: WhatsAppNumberState.Disabled, fields: { [NumberFormField.ConfirmDisable]: CHECKED_VALUE } },
      { target: WhatsAppNumberState.Closed, fields: {} },
    ];
    await steps.reduce(
      (previous, step) =>
        previous.then(async () => {
          const response = await postAction({ path, sessionToken, fields: { [NumberFormField.State]: step.target, ...step.fields } });
          expect(response.status).toBe(STATUS_SEE_OTHER);
          expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=StateChanged`);
          expect(await stateOf({ numberId })).toBe(step.target);
        }),
      Promise.resolve(),
    );
  });

  test('refuses to disable without the confirmation and keeps the state', async () => {
    await seedNumber({ suffix: '0008', label: 'Active', state: WhatsAppNumberState.Active });
    const { posted, followed } = await submitRejectedAction({
      path: '/numbers/num_0008/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Disabled },
    });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await stateOf({ numberId: 'num_0008' })).toBe(WhatsAppNumberState.Active);
  });

  test('refuses a transition the table does not allow and keeps the state', async () => {
    await seedNumber({ suffix: '0009', label: 'Disabled', state: WhatsAppNumberState.Disabled });
    const { posted, followed } = await submitRejectedAction({
      path: '/numbers/num_0009/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Active },
    });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    expect(await stateOf({ numberId: 'num_0009' })).toBe(WhatsAppNumberState.Disabled);
  });

  test('offers no target on a pending number that was never verified', async () => {
    await seedNumber({ suffix: '0010', label: 'Unverified', state: WhatsAppNumberState.Pending });
    await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET verified_at = NULL WHERE id = ?').bind('num_0010').run();
    const body = await (await getPage({ path: '/numbers/num_0010', sessionToken })).text();
    expect(body).toContain(copy[BackofficeCopyKey.NumberStateNoTarget]);
  });

  test('audits the change with the number id', async () => {
    await seedNumber({ suffix: '0011', label: 'Active', state: WhatsAppNumberState.Active });
    await postAction({ path: '/numbers/num_0011/state', sessionToken, fields: { [NumberFormField.State]: WhatsAppNumberState.Closed } });
    const row = await testEnv.CONNECTIONS.prepare('SELECT target_id AS targetId FROM backoffice_audit WHERE action = ?')
      .bind('number.state_changed')
      .first<{ targetId: string }>();
    expect(row).toEqual({ targetId: 'num_0011' });
  });
});

describe('replacing credentials', () => {
  test('replaces the access token and the next resolution opens the new one', async () => {
    await seedNumber({ suffix: '0017', label: 'Token' });
    const response = await postAction({
      path: '/numbers/num_0017/access-token',
      sessionToken,
      fields: { [NumberFormField.AccessToken]: NEW_ACCESS_TOKEN },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/numbers/num_0017?notice=AccessTokenReplaced');
    expect((await registry.openForInbound({ numberId: 'num_0017' })).accessToken).toBe(NEW_ACCESS_TOKEN);
    const detail = await (await getPage({ path: '/numbers/num_0017', sessionToken })).text();
    expect(detail).not.toContain(NEW_ACCESS_TOKEN);
    expect(detail).not.toContain('token-0017');
  });
});

describe('step-up on a number action', () => {
  test('a missing code answers 401 and changes nothing', async () => {
    await seedNumber({ suffix: '0012', label: 'Active', state: WhatsAppNumberState.Active });
    const { posted, followed } = await submitRejectedAction({
      path: '/numbers/num_0012/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
      code: '',
    });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await stateOf({ numberId: 'num_0012' })).toBe(WhatsAppNumberState.Active);
  });

  test('a wrong code answers 401 with the copy, counts one failure and audits step_up.failed', async () => {
    await seedNumber({ suffix: '0013', label: 'Active', state: WhatsAppNumberState.Active });
    const before = (await readOperator()).failed_attempts;
    const { posted, followed } = await submitRejectedAction({
      path: '/numbers/num_0013/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
      code: WRONG_CODE,
    });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.StepUpRejected]);
    expect((await readOperator()).failed_attempts).toBe(before + 1);
    expect(await stateOf({ numberId: 'num_0013' })).toBe(WhatsAppNumberState.Active);
  });

  test('a refused state change keeps the chosen state selected', async () => {
    await seedNumber({ suffix: '0015', label: 'Active', state: WhatsAppNumberState.Active });
    const { posted, followed } = await submitRejectedAction({
      path: '/numbers/num_0015/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Disabled, [NumberFormField.ConfirmDisable]: CHECKED_VALUE },
      code: WRONG_CODE,
    });
    const body = await followed.text();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(body).toMatch(/<input[^>]*value="disabled"[^>]*checked/);
    expect(body).not.toMatch(/<input[^>]*value="closed"[^>]*checked/);
  });

  test('a refusing rate limiter answers 429 with Retry-After 60 and writes nothing', async () => {
    await seedNumber({ suffix: '0014', label: 'Active', state: WhatsAppNumberState.Active });
    const auditRowsBefore = await countRows({ table: 'backoffice_audit' });
    const response = await postAction({
      path: '/numbers/num_0014/state',
      sessionToken,
      fields: { [NumberFormField.State]: WhatsAppNumberState.Closed },
      env: refusingStepUpEnv(),
    });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await stateOf({ numberId: 'num_0014' })).toBe(WhatsAppNumberState.Active);
    expect(await countRows({ table: 'backoffice_audit' })).toBe(auditRowsBefore);
  });
});
