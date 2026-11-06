import { AGENT_NAME_MAX_CHARS } from '@zapbip/core';
import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { buildDirectorySeed } from '../../scripts/build-directory-seed';
import { SEED_CREATED_AT } from '../support/seed';

const PHONE = '5511999990000';

describe('dev seed agent names', () => {
  it('WI-115 rejects an agent name over the character limit', async () => {
    const agent = 'a'.repeat(AGENT_NAME_MAX_CHARS + 1);
    await expect(buildDirectorySeed({ phone: PHONE, agents: [agent], createdAt: SEED_CREATED_AT })).rejects.toMatchObject({
      code: InboxErrorCode.InvalidInput,
      message: 'agents: invalid agent name',
    });
  });

  it('accepts an agent name at the character limit', async () => {
    const agent = 'a'.repeat(AGENT_NAME_MAX_CHARS);
    const seed = await buildDirectorySeed({ phone: PHONE, agents: [agent], createdAt: SEED_CREATED_AT });
    expect(seed.connections.map((connection) => connection.agent)).toEqual([agent]);
  });
});
