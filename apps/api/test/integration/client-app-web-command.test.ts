import { AccountReplyIntent, AccountReplyParameter, AccountState, CommandKind, OwnerLocale } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';

const ACCOUNT = 'acc_client_app_web_command';
const OTHER_ACCOUNT = 'acc_client_app_web_command_other';
const OWNER_PHONE = '5511900000043';
const OTHER_PHONE = '5511900000044';

function applyWebCommand(input: { accountId?: string; kind: CommandKind.CreateAgent | CommandKind.RevokeAgent; rawName: string }) {
  const accountId = input.accountId === undefined ? ACCOUNT : input.accountId;
  const waId = accountId === ACCOUNT ? OWNER_PHONE : OTHER_PHONE;
  const account = { accountId, waId, state: AccountState.Active, locale: OwnerLocale.EnglishUs };
  return accountInboxStub({ accountId }).applyWebCommand({
    account,
    command: { kind: input.kind, rawName: input.rawName, locale: account.locale },
    publicOrigin: testEnv.PUBLIC_ORIGIN,
    appOrigin: testEnv.APP_ORIGIN,
  });
}

function activeAgents(input: { accountId: string }): Promise<string[]> {
  return new D1ConnectionRegistry({ database: testEnv.CONNECTIONS })
    .listActive({ accountId: input.accountId })
    .then((connections) => connections.map((connection) => connection.agent));
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedOwnerIdentity({ accountId: ACCOUNT, phone: OWNER_PHONE, ownerLocale: OwnerLocale.EnglishUs });
  await seedOwnerIdentity({ accountId: OTHER_ACCOUNT, phone: OTHER_PHONE, ownerLocale: OwnerLocale.EnglishUs });
});
afterEach(reset);

describe('AccountInbox applyWebCommand', () => {
  it('creates an agent through the command use case and returns the install prompt', async () => {
    const outcome = await applyWebCommand({ kind: CommandKind.CreateAgent, rawName: 'alpha' });
    expect(outcome).toMatchObject({ ok: true, value: { replies: [{ intent: AccountReplyIntent.Created }] } });
    const parameters = outcome.ok ? outcome.value.replies[0]!.parameters : {};
    expect(parameters[AccountReplyParameter.InstallPrompt]).toContain(`${testEnv.PUBLIC_ORIGIN}/i/zb_inst_`);
    expect(await activeAgents({ accountId: ACCOUNT })).toEqual(['alpha']);
  });

  it('answers a taken name with the refusal and creates nothing twice', async () => {
    await applyWebCommand({ kind: CommandKind.CreateAgent, rawName: 'alpha' });
    const outcome = await applyWebCommand({ kind: CommandKind.CreateAgent, rawName: 'alpha' });
    expect(outcome).toMatchObject({ ok: true, value: { replies: [{ intent: AccountReplyIntent.NameTaken }] } });
    expect(await activeAgents({ accountId: ACCOUNT })).toEqual(['alpha']);
  });

  it('revokes an agent of its own account', async () => {
    await applyWebCommand({ kind: CommandKind.CreateAgent, rawName: 'alpha' });
    const outcome = await applyWebCommand({ kind: CommandKind.RevokeAgent, rawName: 'alpha' });
    expect(outcome).toMatchObject({ ok: true, value: { replies: [{ intent: AccountReplyIntent.Revoked }] } });
    expect(await activeAgents({ accountId: ACCOUNT })).toEqual([]);
  });

  it('never revokes the agent of another account', async () => {
    await applyWebCommand({ accountId: OTHER_ACCOUNT, kind: CommandKind.CreateAgent, rawName: 'alpha' });
    const outcome = await applyWebCommand({ kind: CommandKind.RevokeAgent, rawName: 'alpha' });
    expect(outcome).toMatchObject({ ok: true, value: { replies: [{ intent: AccountReplyIntent.NotFound }] } });
    expect(await activeAgents({ accountId: OTHER_ACCOUNT })).toEqual(['alpha']);
  });
});
