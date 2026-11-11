import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { CHECKED_VALUE, NEW_META_APP_VALUE, NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { seedAccount } from '../support/seed';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { readOperator } from './backoffice-auth-fixtures';
import {
  ACCESS_TOKEN,
  APP_SECRET,
  countRows,
  endBackofficeSession,
  getPage,
  numberIdOf,
  PHONE_NUMBER_ID,
  postAction,
  refusingStepUpEnv,
  REGISTER_PATH,
  registrationFields,
  startBackofficeSession,
  stateOf,
  submitRejectedAction,
} from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_UNPROCESSABLE = 422;
const STATUS_CONFLICT = 409;
const STATUS_TOO_MANY_REQUESTS = 429;
const EVIL_ORIGIN = 'https://evil.example';
const NEW_ACCESS_TOKEN = 'replacement-access-token-ta2';
const NEW_APP_SECRET = 'replacement-app-secret-sx2';
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

async function registerBrazil(): Promise<string> {
  const response = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}) });
  expect(response.status).toBe(STATUS_SEE_OTHER);
  return numberIdOf({ response });
}

describe('the numbers list', () => {
  test('shows the empty state and a link to register when there is no number', async () => {
    const response = await getPage({ path: '/numbers', sessionToken });
    const body = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(body).toContain(copy[BackofficeCopyKey.NumbersEmptyTitle]);
    expect(body).toContain(`href="${REGISTER_PATH}"`);
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

describe('the preference switches on a number page', () => {
  test.each([
    ['the detail page', '/numbers/num_0001'],
    ['the verification page', '/numbers/num_0001/verification'],
    ['the register page', REGISTER_PATH],
  ])('return to %s', async (_name, path) => {
    await seedNumber({ suffix: '0001', label: 'Alpha' });
    const body = await (await getPage({ path, sessionToken })).text();
    expect(body.split(`name="returnTo" value="${path}"`)).toHaveLength(3);
  });
});

describe('registering a number', () => {
  test('creates a pending number, redirects to it and shows no credential', async () => {
    const response = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}) });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    const numberId = numberIdOf({ response });
    expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=Registered`);
    expect(await stateOf({ numberId })).toBe(WhatsAppNumberState.Pending);
    const detail = await (await getPage({ path: `/numbers/${numberId}`, sessionToken })).text();
    const list = await (await getPage({ path: '/numbers', sessionToken })).text();
    [detail, list, await response.text()].forEach((body) => {
      expect(body).not.toContain(ACCESS_TOKEN);
      expect(body).not.toContain(APP_SECRET);
    });
    expect((await registry.openForInbound({ numberId })).accessToken).toBe(ACCESS_TOKEN);
  });

  test('registers on an existing Meta app without a new app secret', async () => {
    await seedNumber({ suffix: '0005', label: 'First' });
    const fields = registrationFields({ [NumberFormField.MetaApp]: 'app_0005' });
    const response = await postAction({ path: REGISTER_PATH, sessionToken, fields });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(await countRows({ table: 'meta_apps' })).toBe(1);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(2);
  });

  test('binds the accounts without a number when the first number is registered and says so', async () => {
    await seedAccount({ accountId: 'acc_unbound' });
    const response = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}) });
    expect(response.headers.get('Location')).toContain('notice=RegisteredWithBackfill');
    const row = await testEnv.CONNECTIONS.prepare('SELECT number_id AS numberId FROM accounts WHERE id = ?')
      .bind('acc_unbound')
      .first<{ numberId: string | null }>();
    expect(row?.numberId).toBe(numberIdOf({ response }));
  });

  test('writes one audit row for the registration without any submitted value', async () => {
    const numberId = await registerBrazil();
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM backoffice_audit WHERE action = ?')
      .bind('number.registered')
      .all<Record<string, unknown>>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({ target_kind: 'number', target_id: numberId });
    expect(JSON.stringify(rows.results)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(rows.results)).not.toContain(APP_SECRET);
  });

  test.each([
    { field: NumberFormField.PhoneNumberId, value: 'abc', message: BackofficeCopyKey.FieldErrorDigits },
    { field: NumberFormField.WabaId, value: '12 34', message: BackofficeCopyKey.FieldErrorDigits },
    { field: NumberFormField.DisplayNumber, value: '5511955550000', message: BackofficeCopyKey.FieldErrorDisplayNumber },
    { field: NumberFormField.Label, value: 'x'.repeat(61), message: BackofficeCopyKey.FieldErrorLabelLength },
    { field: NumberFormField.AccessToken, value: '', message: BackofficeCopyKey.FieldErrorRequired },
  ])('answers 422 with the copy for an invalid $field and registers nothing', async ({ field, value, message }) => {
    const { posted, followed } = await submitRejectedAction({
      path: REGISTER_PATH,
      sessionToken,
      fields: registrationFields({ [field]: value }),
    });
    const body = await followed.text();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(posted.headers.get('Location')).toBe(REGISTER_PATH);
    expect(followed.status).toBe(STATUS_UNPROCESSABLE);
    expect(body).toContain(copy[message]);
    expect(body).not.toContain(APP_SECRET);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
    expect(await countRows({ table: 'meta_apps' })).toBe(0);
  });

  test('answers 409 on a phone number id that is already registered and keeps one row', async () => {
    await registerBrazil();
    const fields = registrationFields({
      [NumberFormField.MetaAppId]: '900000000556',
      [NumberFormField.DisplayNumber]: '+5511955550001',
    });
    const { posted, followed } = await submitRejectedAction({ path: REGISTER_PATH, sessionToken, fields });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_CONFLICT);
    expect(await followed.text()).toContain(copy[BackofficeCopyKey.FieldErrorDuplicate]);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(1);
    expect(await countRows({ table: 'meta_apps' })).toBe(1);
  });

  test('answers 403 for a foreign origin and registers nothing', async () => {
    const response = await postAction({ path: REGISTER_PATH, sessionToken, fields: registrationFields({}), origin: EVIL_ORIGIN });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
  });

  test('shows the register form with the existing Meta apps and the new-app option', async () => {
    await seedNumber({ suffix: '0006', label: 'First' });
    const body = await (await getPage({ path: REGISTER_PATH, sessionToken })).text();
    expect(body).toContain(copy[BackofficeCopyKey.RegisterMetaAppAddNew]);
    expect(body).toContain('value="app_0006"');
    expect(body).toContain(`value="${NEW_META_APP_VALUE}"`);
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
    const numberId = await registerBrazil();
    const response = await postAction({
      path: `/numbers/${numberId}/access-token`,
      sessionToken,
      fields: { [NumberFormField.AccessToken]: NEW_ACCESS_TOKEN },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=AccessTokenReplaced`);
    expect((await registry.openForInbound({ numberId })).accessToken).toBe(NEW_ACCESS_TOKEN);
    const detail = await (await getPage({ path: `/numbers/${numberId}`, sessionToken })).text();
    expect(detail).not.toContain(NEW_ACCESS_TOKEN);
    expect(detail).not.toContain(ACCESS_TOKEN);
  });

  test('replaces the app secret of the Meta app and audits it', async () => {
    const numberId = await registerBrazil();
    const row = await testEnv.CONNECTIONS.prepare('SELECT meta_app_ref AS metaAppRef FROM whatsapp_numbers WHERE id = ?')
      .bind(numberId)
      .first<{ metaAppRef: string }>();
    const metaAppRef = row?.metaAppRef;
    if (metaAppRef === undefined) throw new Error('the number has no Meta app');
    const response = await postAction({
      path: `/meta-apps/${metaAppRef}/app-secret`,
      sessionToken,
      fields: { [NumberFormField.AppSecret]: NEW_APP_SECRET, [NumberFormField.NumberId]: numberId },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`/numbers/${numberId}?notice=AppSecretReplaced`);
    expect(await registry.openAppSecret({ metaAppRef })).toBe(NEW_APP_SECRET);
    const audit = await testEnv.CONNECTIONS.prepare('SELECT target_id AS targetId FROM backoffice_audit WHERE action = ?')
      .bind('meta_app.app_secret_rotated')
      .first<{ targetId: string }>();
    expect(audit).toEqual({ targetId: metaAppRef });
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

  test('a refused register keeps the typed non-secret fields and never echoes the secrets', async () => {
    const { posted, followed } = await submitRejectedAction({
      path: REGISTER_PATH,
      sessionToken,
      fields: registrationFields({}),
      code: WRONG_CODE,
    });
    const body = await followed.text();
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(STATUS_UNAUTHORIZED);
    expect(body).toContain(PHONE_NUMBER_ID);
    expect(body).not.toContain(ACCESS_TOKEN);
    expect(body).not.toContain(APP_SECRET);
    expect(await countRows({ table: 'whatsapp_numbers' })).toBe(0);
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
