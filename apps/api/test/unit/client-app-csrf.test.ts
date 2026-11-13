import { describe, expect, it } from 'vitest';
import { csrfTokenOf, isCsrfTokenValid } from '../../src/client-app/csrf';

describe('csrfTokenOf', () => {
  it('is stable for one secret', async () => {
    expect(await csrfTokenOf({ secret: 'one' })).toBe(await csrfTokenOf({ secret: 'one' }));
  });

  it('differs between secrets', async () => {
    expect(await csrfTokenOf({ secret: 'one' })).not.toBe(await csrfTokenOf({ secret: 'two' }));
  });

  it('never contains the secret', async () => {
    expect(await csrfTokenOf({ secret: 'one-secret-value' })).not.toContain('one-secret-value');
  });
});

describe('isCsrfTokenValid', () => {
  it('accepts the token of the same secret', async () => {
    expect(await isCsrfTokenValid({ secret: 'one', submittedToken: await csrfTokenOf({ secret: 'one' }) })).toBe(true);
  });

  it.each(['', 'wrong', 'x'.repeat(200)])('refuses %j', async (submittedToken) => {
    expect(await isCsrfTokenValid({ secret: 'one', submittedToken })).toBe(false);
  });

  it('refuses the token of another secret', async () => {
    expect(await isCsrfTokenValid({ secret: 'one', submittedToken: await csrfTokenOf({ secret: 'two' }) })).toBe(false);
  });
});
