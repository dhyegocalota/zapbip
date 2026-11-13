import { AccountReplyIntent, AccountState, AccountStateOutcome, CommandKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AccountCommand } from './account-types';
import { evaluateAccountState } from './state-gate';

function commandOf(input: { kind: CommandKind }): AccountCommand {
  return { kind: input.kind, rawName: null, locale: OwnerLocale.PortugueseBrazil };
}

function evaluate(input: { state: AccountState; kind?: CommandKind; isFirstMessage?: boolean; isText?: boolean }) {
  const { state, kind, isFirstMessage = false, isText = true } = input;
  return evaluateAccountState({ state, command: kind === undefined ? null : commandOf({ kind }), isFirstMessage, isText });
}

const proceed = { outcome: AccountStateOutcome.Proceed, intent: null };
const waitlisted = { outcome: AccountStateOutcome.Reply, intent: AccountReplyIntent.Waitlisted };
const suspended = { outcome: AccountStateOutcome.Reply, intent: AccountReplyIntent.Suspended };
const dropped = { outcome: AccountStateOutcome.Drop, intent: null };

describe('evaluateAccountState', () => {
  test('a waitlisted account may ask for help', () => {
    expect(evaluate({ state: AccountState.Waitlisted, kind: CommandKind.Help })).toEqual(proceed);
  });

  test('a waitlisted account may request and confirm its deletion', () => {
    expect(evaluate({ state: AccountState.Waitlisted, kind: CommandKind.RequestDeletion })).toEqual(proceed);
    expect(evaluate({ state: AccountState.Waitlisted, kind: CommandKind.ConfirmDeletion })).toEqual(proceed);
  });

  test('a waitlisted account may sign in to the web app', () => {
    expect(evaluate({ state: AccountState.Waitlisted, kind: CommandKind.Login })).toEqual(proceed);
  });

  test('a suspended account cannot sign in to the web app', () => {
    expect(evaluate({ state: AccountState.Suspended, kind: CommandKind.Login })).toEqual(suspended);
  });

  test('a waitlisted account cannot create agents', () => {
    expect(evaluate({ state: AccountState.Waitlisted, kind: CommandKind.CreateAgent })).toEqual(waitlisted);
  });

  test('a waitlisted account gets the waitlist reply for plain text', () => {
    expect(evaluate({ state: AccountState.Waitlisted })).toEqual(waitlisted);
  });

  test('the waitlist reply wins over the unknown reply for a first non-text message', () => {
    expect(evaluate({ state: AccountState.Waitlisted, isFirstMessage: true, isText: false })).toEqual(waitlisted);
  });

  test('a suspended account gets the suspended reply for text, commands and deletion', () => {
    expect(evaluate({ state: AccountState.Suspended })).toEqual(suspended);
    expect(evaluate({ state: AccountState.Suspended, kind: CommandKind.Help })).toEqual(suspended);
    expect(evaluate({ state: AccountState.Suspended, kind: CommandKind.ConfirmDeletion })).toEqual(suspended);
  });

  test('a deleting account drops everything', () => {
    expect(evaluate({ state: AccountState.Deleting })).toEqual(dropped);
    expect(evaluate({ state: AccountState.Deleting, kind: CommandKind.ConfirmDeletion })).toEqual(dropped);
  });

  test('an active account proceeds with text and with confirmation', () => {
    expect(evaluate({ state: AccountState.Active })).toEqual(proceed);
    expect(evaluate({ state: AccountState.Active, kind: CommandKind.ConfirmDeletion })).toEqual(proceed);
  });

  test('a first non-text message of an active account gets the unknown reply', () => {
    expect(evaluate({ state: AccountState.Active, isFirstMessage: true, isText: false })).toEqual({
      outcome: AccountStateOutcome.Reply,
      intent: AccountReplyIntent.Unknown,
    });
  });

  test('a later non-text message of an active account proceeds', () => {
    expect(evaluate({ state: AccountState.Active, isFirstMessage: false, isText: false })).toEqual(proceed);
  });
});
