import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { LogEvent, type LogFields } from '../../src/contract/log';
import { logEvent } from '../../src/log';

const ACCOUNT_ID = 'acc_log_event';
const SECRET_KEYS = ['secret', 'connectionSecret', 'installCode', 'digest', 'phone', 'text'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logEvent', () => {
  it('writes one structured line with the event name and the account id only', () => {
    const lines = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logEvent({ event: LogEvent.AccountCreated, accountId: ACCOUNT_ID });
    expect(lines).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(lines.mock.calls[0][0]))).toEqual({ event: LogEvent.AccountCreated, accountId: ACCOUNT_ID });
  });

  it('has no field that can carry a secret, a digest, a phone or a text', () => {
    SECRET_KEYS.forEach((key) => expectTypeOf<LogFields>().not.toHaveProperty(key));
  });
});
