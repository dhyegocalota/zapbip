import { MINUTE_MS } from '@zapbip/types';
import { beforeEach, describe, expect, test } from 'vitest';
import { testEnv } from '../support/workers-env';
import { requestBackoffice, resetBackoffice, SESSION_COOKIE, signIn } from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const ROW_COUNT = 250;
const PAGE_LIMIT = 200;
const FIRST_AT = Date.UTC(2026, 0, 1);

beforeEach(resetBackoffice);

function targetOf(input: { index: number }): string {
  return `T${String(input.index).padStart(4, '0')}`;
}

async function seedAuditRows(): Promise<void> {
  const database = testEnv.CONNECTIONS;
  const statements = Array.from({ length: ROW_COUNT }, (_, offset) => {
    const index = offset + 1;
    return database
      .prepare(
        'INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(`audit-${index}`, FIRST_AT + index * MINUTE_MS, 'number.verified', 'number', targetOf({ index }), 'succeeded', '203.0.113.7');
  });
  await database.batch(statements);
}

describe('audit page', () => {
  test('lists exactly the newest 200 rows, newest first', async () => {
    await seedAuditRows();
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({ path: '/audit', cookies: { [SESSION_COOKIE]: sessionToken } });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html.match(/<tr class="audit-row"/g)).toHaveLength(PAGE_LIMIT);
    expect(html).toContain(targetOf({ index: ROW_COUNT }));
    expect(html).toContain(targetOf({ index: ROW_COUNT - PAGE_LIMIT + 1 }));
    expect(html).not.toContain(targetOf({ index: ROW_COUNT - PAGE_LIMIT }));
    expect(html.indexOf(targetOf({ index: ROW_COUNT }))).toBeLessThan(html.indexOf(targetOf({ index: ROW_COUNT - 1 })));
  });

  test('renders one h1 and the empty state without rows', async () => {
    const { sessionToken } = await signIn({});
    const html = await (await requestBackoffice({ path: '/audit', cookies: { [SESSION_COOKIE]: sessionToken } })).text();
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).not.toContain('<tr class="audit-row"');
  });

  test('redirects to sign-in without a session', async () => {
    const response = await requestBackoffice({ path: '/audit' });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/sign-in');
  });
});
