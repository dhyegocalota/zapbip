import { CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { logFieldsOfAccountResult } from '../../src/account-inbox/account-log';
import { LogEvent } from '../../src/contract/log';

const BASE = { messageId: null, agent: null, duplicate: false, deletionConfirmed: false };
const ACCOUNT_ID = 'acc_log';
const CONNECTION_ID = 'con_log';
const LOCALE = OwnerLocale.PortugueseBrazil;

function fieldsOf(input: { commandKind: CommandKind | null; connectionId: string | null; duplicate?: boolean }) {
  const { duplicate = false } = input;
  return logFieldsOfAccountResult({
    result: { ...BASE, duplicate, commandKind: input.commandKind, connectionId: input.connectionId },
    accountId: ACCOUNT_ID,
    locale: LOCALE,
  });
}

describe('logFieldsOfAccountResult', () => {
  it.each([
    [CommandKind.CreateAgent, LogEvent.ConnectionCreated],
    [CommandKind.RevokeAgent, LogEvent.ConnectionRevoked],
    [CommandKind.RotateAgent, LogEvent.ConnectionRotated],
  ])('logs the command and the %s connection event with the connection id', (commandKind, event) => {
    expect(fieldsOf({ commandKind, connectionId: CONNECTION_ID })).toEqual([
      { event: LogEvent.CommandReceived, accountId: ACCOUNT_ID, kind: commandKind, locale: LOCALE },
      { event, accountId: ACCOUNT_ID, connectionId: CONNECTION_ID },
    ]);
  });

  it('logs only the command when no connection changed', () => {
    expect(fieldsOf({ commandKind: CommandKind.ListAgents, connectionId: null })).toEqual([
      { event: LogEvent.CommandReceived, accountId: ACCOUNT_ID, kind: CommandKind.ListAgents, locale: LOCALE },
    ]);
  });

  it('logs nothing for a plain message or a duplicate', () => {
    expect(fieldsOf({ commandKind: null, connectionId: null })).toEqual([]);
    expect(fieldsOf({ commandKind: CommandKind.CreateAgent, connectionId: CONNECTION_ID, duplicate: true })).toEqual([]);
  });

  it('never carries an agent name, a secret or text', () => {
    const serialised = JSON.stringify(fieldsOf({ commandKind: CommandKind.CreateAgent, connectionId: CONNECTION_ID }));
    expect(serialised).not.toMatch(/zb_conn_|zb_inst_|agent/);
  });
});
