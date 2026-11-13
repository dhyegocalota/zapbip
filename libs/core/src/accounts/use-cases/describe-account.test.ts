import { AccountState, InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../../inbox/testing/capture-inbox-error';
import { touchAgent } from '../../inbox/use-cases/touch-agent';
import { addAgent, agentRequestOf, createAccountFixture } from '../testing/fixtures';
import { describeAccount } from './describe-account';

describe('describeAccount', () => {
  test('lists the active agents of the calling account with their last activity', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await addAgent({ ...fixture, agent: 'codex' });
    await touchAgent({ dependencies: fixture.environment.dependencies, agent: 'claude' });
    const overview = await describeAccount(agentRequestOf(fixture));
    expect(overview.state).toBe(AccountState.Active);
    expect(overview.agents.map(({ agent, lastSeenAt }) => ({ agent, seen: lastSeenAt !== null }))).toEqual([
      { agent: 'claude', seen: true },
      { agent: 'codex', seen: false },
    ]);
  });

  test('never lists the agents of another account', async () => {
    const fixture = await createAccountFixture();
    const other = {
      environment: fixture.environment,
      account: await fixture.environment.openAccount({ accountId: 'acc_other', waId: '14155550100' }),
    };
    await addAgent({ ...other, agent: 'stranger' });
    const overview = await describeAccount(agentRequestOf(fixture));
    expect(overview.agents).toEqual([]);
  });

  test('refuses a connection whose account does not exist', async () => {
    const fixture = await createAccountFixture();
    const request = agentRequestOf(fixture);
    const error = await captureInboxError(() =>
      describeAccount({ ...request, connection: { ...request.connection, accountId: 'acc_missing' } }),
    );
    expect(error.code).toBe(InboxErrorCode.NotFound);
  });
});
