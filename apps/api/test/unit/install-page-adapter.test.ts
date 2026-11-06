import type { ConnectionRecord } from '@zapbip/core';
import { WakeMode } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { joinStandbyCandidates } from '../../src/install/install-page-adapter';

function buildConnection(input: { agent: string; createdAt: number }): ConnectionRecord {
  return {
    connectionId: `con_${input.agent}`,
    accountId: 'acc_1',
    agent: input.agent,
    secretDigest: 'digest',
    clientName: null,
    firstCallAt: null,
    createdAt: input.createdAt,
    installCodeDigest: null,
    installCodeSealedSecret: null,
    installCodeExpiresAt: null,
  };
}

describe('joinStandbyCandidates', () => {
  it('joins each active connection with its wake mode by agent name', () => {
    expect(
      joinStandbyCandidates({
        connections: [buildConnection({ agent: 'ana', createdAt: 10 }), buildConnection({ agent: 'bia', createdAt: 20 })],
        wakeModes: [
          { agent: 'bia', wakeMode: WakeMode.Webhook },
          { agent: 'ana', wakeMode: WakeMode.None },
        ],
      }),
    ).toEqual([
      { agent: 'ana', createdAt: 10, wakeMode: WakeMode.None },
      { agent: 'bia', createdAt: 20, wakeMode: WakeMode.Webhook },
    ]);
  });

  it('drops a connection that has no wake mode entry', () => {
    expect(joinStandbyCandidates({ connections: [buildConnection({ agent: 'ana', createdAt: 10 })], wakeModes: [] })).toEqual([]);
  });

  it('drops a wake mode entry of an agent that is not an active connection', () => {
    expect(joinStandbyCandidates({ connections: [], wakeModes: [{ agent: 'gone', wakeMode: WakeMode.Webhook }] })).toEqual([]);
  });
});
