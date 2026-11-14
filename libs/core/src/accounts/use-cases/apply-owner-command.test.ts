import { AccountReplyIntent, AccountReplyParameter, CommandKind, OwnerLocale, ReplyKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AccountCommand } from '../account-types';
import { createAccountFixture, intentsOf, ownerInputOf } from '../testing/fixtures';
import { applyOwnerCommand } from './apply-owner-command';

function commandOf(input: { kind: CommandKind; rawName?: string | null; locale?: OwnerLocale }): AccountCommand {
  const { kind, rawName = null, locale = OwnerLocale.PortugueseBrazil } = input;
  return { kind, rawName, locale };
}

async function apply(input: { command: AccountCommand }) {
  const fixture = await createAccountFixture();
  const result = await applyOwnerCommand({ ...ownerInputOf(fixture), command: input.command, isRequestLive: false });
  return { fixture, result };
}

describe('applyOwnerCommand', () => {
  test('agents lists the active connections', async () => {
    const { result } = await apply({ command: commandOf({ kind: CommandKind.ListAgents }) });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.EmptyList]);
  });

  test('help replies with the menu list of the seven commands', async () => {
    const { result } = await apply({ command: commandOf({ kind: CommandKind.Help }) });
    const [reply] = result.replies;
    expect(result.replies).toHaveLength(1);
    expect(reply!.intent).toBe(AccountReplyIntent.Menu);
    expect(reply!.kind).toBe(ReplyKind.List);
    expect(reply!.menuRows.map((row) => row.id)).toEqual([
      'zapbip:create_agent',
      'zapbip:list_agents',
      'zapbip:revoke_agent',
      'zapbip:rotate_agent',
      'zapbip:help',
      'zapbip:set_language',
      'zapbip:request_deletion',
    ]);
  });

  test.each([
    { kind: CommandKind.CreateAgent, usage: 'novo agente <nome>' },
    { kind: CommandKind.RevokeAgent, usage: 'revogar <nome>' },
    { kind: CommandKind.RotateAgent, usage: 'renovar <nome>' },
  ])('a list tap for $kind replies with its usage line and changes nothing', async ({ kind, usage }) => {
    const { fixture, result } = await apply({ command: commandOf({ kind }) });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Usage]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.Usage]).toBe(usage);
    expect(await fixture.environment.registry.listActive({ accountId: fixture.account.accountId })).toEqual([]);
    expect(result.compensation).toBeNull();
  });

  test('an unknown command replies unknown', async () => {
    const { result } = await apply({ command: commandOf({ kind: CommandKind.Unknown }) });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Unknown]);
  });

  test('the reply uses the language of the keyword, not of the account', async () => {
    const { result } = await apply({ command: commandOf({ kind: CommandKind.RevokeAgent, locale: OwnerLocale.EnglishUs }) });
    expect(result.replies[0]!.locale).toBe(OwnerLocale.EnglishUs);
    expect(result.replies[0]!.parameters[AccountReplyParameter.Usage]).toBe('revoke <name>');
  });

  test('request deletion replies with the confirmation phrase', async () => {
    const { result } = await apply({ command: commandOf({ kind: CommandKind.RequestDeletion }) });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.DeletionRequest]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.Phrase]).toBe('apagar conta definitivamente');
    expect(result.deletionConfirmed).toBe(false);
  });
});
