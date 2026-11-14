import { describe, expect, it } from 'vitest';
import { wakeTarget } from './wake';

describe('the grok-bot wake target', () => {
  it('accepts a webhook path with a short or long id and refuses a shorter id and another path', () => {
    expect(wakeTarget.pathPattern.test('/automations/webhook/abcdefgh12')).toBe(true);
    expect(wakeTarget.pathPattern.test('/automations/webhook/short')).toBe(false);
    expect(wakeTarget.pathPattern.test('/automations/other/abcdefgh12')).toBe(false);
  });

  it('sends the token as a bearer credential', () => {
    expect(wakeTarget.buildHeaders({ token: 'abc' })).toEqual({ authorization: 'Bearer abc', 'content-type': 'application/json' });
  });

  it('carries an example URL that its own host and path pattern accept', () => {
    const example = new URL(wakeTarget.exampleUrl);
    expect(example.hostname).toBe(wakeTarget.host);
    expect(wakeTarget.pathPattern.test(example.pathname)).toBe(true);
  });
});
