import type { ReceiveAccountMessageResult } from '@zapbip/core';
import { CommandKind } from '@zapbip/types';
import { LogEvent, type LogFields } from '../contract/log';

const CONNECTION_EVENTS: Partial<Record<CommandKind, LogEvent>> = {
  [CommandKind.CreateAgent]: LogEvent.ConnectionCreated,
  [CommandKind.RevokeAgent]: LogEvent.ConnectionRevoked,
  [CommandKind.RotateAgent]: LogEvent.ConnectionRotated,
};

export function logFieldsOfAccountResult(input: { result: ReceiveAccountMessageResult; accountId: string; locale: string }): LogFields[] {
  const { result, accountId, locale } = input;
  const { commandKind, connectionId } = result;
  if (commandKind === null || result.duplicate) return [];
  const command: LogFields = { event: LogEvent.CommandReceived, accountId, kind: commandKind, locale };
  const event = CONNECTION_EVENTS[commandKind];
  if (event === undefined || connectionId === null) return [command];
  return [command, { event, accountId, connectionId }];
}
