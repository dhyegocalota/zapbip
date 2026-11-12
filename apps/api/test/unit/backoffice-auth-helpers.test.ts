import { describe, expect, it } from 'vitest';
import { csrfTokenOf, isSessionCsrfTokenValid } from '../../src/backoffice/auth/csrf';

const SESSION_TOKEN = 'session-token-a';
const OTHER_SESSION_TOKEN = 'session-token-b';

describe('csrf token', () => {
  it('is stable for one session', async () => {
    expect(await csrfTokenOf({ sessionToken: SESSION_TOKEN })).toBe(await csrfTokenOf({ sessionToken: SESSION_TOKEN }));
  });

  it('differs between sessions', async () => {
    expect(await csrfTokenOf({ sessionToken: SESSION_TOKEN })).not.toBe(await csrfTokenOf({ sessionToken: OTHER_SESSION_TOKEN }));
  });

  it('is refused by another session', async () => {
    const submittedToken = await csrfTokenOf({ sessionToken: SESSION_TOKEN });
    expect(await isSessionCsrfTokenValid({ sessionToken: SESSION_TOKEN, submittedToken })).toBe(true);
    expect(await isSessionCsrfTokenValid({ sessionToken: OTHER_SESSION_TOKEN, submittedToken })).toBe(false);
  });
});
