import { AccountReplyIntent, AgentCommandRecipient, CommandKind, InboxErrorCode, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../../inbox/testing/capture-inbox-error';
import { agentRequestOf, createAccountFixture, PUBLIC_ORIGIN, sessionTexts, type AccountFixture } from '../testing/fixtures';
import { applyAgentCommand } from './apply-agent-command';

function createCommandOf(input: AccountFixture & { rawName: string }) {
  return { kind: CommandKind.CreateAgent, rawName: input.rawName, locale: input.account.locale } as const;
}

describe('applyAgentCommand', () => {
  test('creates the agent and sends the install link to the owner, never to the caller', async () => {
    const fixture = await createAccountFixture();
    const result = await applyAgentCommand({
      ...agentRequestOf(fixture),
      command: createCommandOf({ ...fixture, rawName: 'codex' }),
      recipient: AgentCommandRecipient.Owner,
    });
    const [issued] = fixture.environment.secrets.issued;
    expect(result).toEqual({ intent: AccountReplyIntent.Created, installPrompt: null });
    expect(sessionTexts(fixture).join('\n')).toContain(`${PUBLIC_ORIGIN}/i/`);
    expect(JSON.stringify(result)).not.toContain(issued!.secret);
  });

  test('hands the install prompt to the caller and sends nothing to the owner', async () => {
    const fixture = await createAccountFixture();
    const result = await applyAgentCommand({
      ...agentRequestOf(fixture),
      command: createCommandOf({ ...fixture, rawName: 'codex' }),
      recipient: AgentCommandRecipient.Agent,
    });
    const [issued] = fixture.environment.secrets.issued;
    expect(result.intent).toBe(AccountReplyIntent.Created);
    expect(result.installPrompt).toContain(`${PUBLIC_ORIGIN}/i/`);
    expect(result.installPrompt).not.toContain(issued!.secret);
    expect(fixture.environment.sender.sessions).toEqual([]);
  });

  test('sends the sign-in link to the owner and returns only the intent', async () => {
    const fixture = await createAccountFixture();
    const result = await applyAgentCommand({
      ...agentRequestOf(fixture),
      command: { kind: CommandKind.Login, rawName: null, locale: fixture.account.locale },
      recipient: AgentCommandRecipient.Owner,
    });
    const [issued] = fixture.environment.signInLinks.issued;
    expect(result).toEqual({ intent: AccountReplyIntent.SignInLink, installPrompt: null });
    expect(sessionTexts(fixture).join('\n')).toContain(issued!.token);
    expect(JSON.stringify(result)).not.toContain(issued!.token);
  });

  test('revokes the connection again and reports the failure when the owner cannot be reached', async () => {
    const fixture = await createAccountFixture();
    fixture.environment.sender.failSessionCalls({ callNumbers: [1] });
    const result = await applyAgentCommand({
      ...agentRequestOf(fixture),
      command: createCommandOf({ ...fixture, rawName: 'codex' }),
      recipient: AgentCommandRecipient.Owner,
    });
    expect(result).toEqual({ intent: AccountReplyIntent.SendFailed, installPrompt: null });
    expect(await fixture.environment.registry.listActive({ accountId: fixture.account.accountId })).toEqual([]);
  });

  test('refuses a connection whose account does not exist', async () => {
    const fixture = await createAccountFixture();
    const request = agentRequestOf(fixture);
    const error = await captureInboxError(() =>
      applyAgentCommand({
        ...request,
        connection: { ...request.connection, accountId: 'acc_missing' },
        command: createCommandOf({ ...fixture, rawName: 'codex' }),
        recipient: AgentCommandRecipient.Owner,
      }),
    );
    expect(error.code).toBe(InboxErrorCode.NotFound);
    expect(fixture.environment.sender.sessions.filter((message) => message.kind === MessageKind.Text)).toEqual([]);
  });
});
