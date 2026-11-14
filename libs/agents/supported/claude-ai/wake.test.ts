import { describe, expect, it } from 'vitest';
import { wakeTarget } from './wake';

const FIRE_PATH = '/v1/claude_code/routines/trig_01abc/fire';

describe('the claude-ai wake target', () => {
  it('accepts a routine fire path and refuses another path on the host', () => {
    expect(wakeTarget.pathPattern.test(FIRE_PATH)).toBe(true);
    expect(wakeTarget.pathPattern.test('/v1/messages')).toBe(false);
    expect(wakeTarget.pathPattern.test(`${FIRE_PATH}/extra`)).toBe(false);
  });

  it('sends the token as a bearer credential with the beta and version headers', () => {
    expect(wakeTarget.buildHeaders({ token: 'abc' })).toEqual({
      authorization: 'Bearer abc',
      'content-type': 'application/json',
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
    });
  });

  it('carries an example URL that its own host and path pattern accept', () => {
    const example = new URL(wakeTarget.exampleUrl);
    expect(example.hostname).toBe(wakeTarget.host);
    expect(wakeTarget.pathPattern.test(example.pathname)).toBe(true);
  });
});
