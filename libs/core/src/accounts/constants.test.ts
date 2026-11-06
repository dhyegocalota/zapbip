import { describe, expect, test } from 'vitest';
import { AGENTS_PER_ACCOUNT_LIMIT, NEW_ACCOUNTS_PER_DAY_LIMIT } from './constants';

describe('account limits', () => {
  test('keep the values the spec states', () => {
    expect(AGENTS_PER_ACCOUNT_LIMIT).toBe(8);
    expect(NEW_ACCOUNTS_PER_DAY_LIMIT).toBe(50);
  });
});
