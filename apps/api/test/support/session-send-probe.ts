import type { MessageSender } from '@zapbip/core';
import { runInDurableObject } from 'cloudflare:test';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import { accountInboxStub, testEnv } from './workers-env';

type SenderInternals = { sender: MessageSender; dependencies: { waiters: { hasAgentWaiter(input: { agent: string }): boolean } } };
type SessionSend = MessageSender['session'];

function wrapNextSessionSend(input: {
  accountId: string;
  wrap: (send: { original: SessionSend; internals: SenderInternals }) => SessionSend;
}) {
  return runInDurableObject(accountInboxStub({ accountId: input.accountId }), (instance: AccountInbox) => {
    const internals = instance as unknown as SenderInternals;
    const original = internals.sender.session.bind(internals.sender);
    internals.sender.session = async (sessionInput) => {
      internals.sender.session = original;
      return input.wrap({ original, internals })(sessionInput);
    };
  });
}

export function failNextSessionSend(input: { accountId: string }): Promise<void> {
  return wrapNextSessionSend({
    accountId: input.accountId,
    wrap: () => async () => {
      throw new Error('session send failed');
    },
  });
}

export async function recordWaiterAtNextSessionSend(input: { accountId: string; agent: string }): Promise<() => boolean | null> {
  const observation: { value: boolean | null } = { value: null };
  await wrapNextSessionSend({
    accountId: input.accountId,
    wrap:
      ({ original, internals }) =>
      async (sessionInput) => {
        observation.value = internals.dependencies.waiters.hasAgentWaiter({ agent: input.agent });
        return original(sessionInput);
      },
  });
  return () => observation.value;
}

export async function recordAccountStateAtNextSessionSend(input: { accountId: string }): Promise<() => string | null> {
  const observation: { value: string | null } = { value: null };
  await wrapNextSessionSend({
    accountId: input.accountId,
    wrap:
      ({ original }) =>
      async (sessionInput) => {
        const row = await testEnv.CONNECTIONS.prepare('SELECT state FROM accounts WHERE id = ?')
          .bind(input.accountId)
          .first<{ state: string }>();
        observation.value = row === null ? null : row.state;
        return original(sessionInput);
      },
  });
  return () => observation.value;
}

export async function countSessionSends(input: { accountId: string }): Promise<() => number> {
  const observation = { count: 0 };
  await runInDurableObject(accountInboxStub({ accountId: input.accountId }), (instance: AccountInbox) => {
    const internals = instance as unknown as SenderInternals;
    const original = internals.sender.session.bind(internals.sender);
    internals.sender.session = async (sessionInput) => {
      observation.count += 1;
      return original(sessionInput);
    };
  });
  return () => observation.count;
}
