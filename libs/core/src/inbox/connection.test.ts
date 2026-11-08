import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { connectionKeyOf } from './connection';

describe('connectionKeyOf', () => {
  test('joins the account and the agent', () => {
    const connection = { accountId: 'acc_1', agent: 'claude', ownerLocale: OwnerLocale.EnglishUs };
    expect(connectionKeyOf({ connection })).toBe('acc_1:claude');
  });

  test('keeps two agents of one account apart', () => {
    const first = { accountId: 'acc_1', agent: 'claude', ownerLocale: OwnerLocale.EnglishUs };
    const second = { ...first, agent: 'agent-two' };
    expect(connectionKeyOf({ connection: first })).not.toBe(connectionKeyOf({ connection: second }));
  });
});
