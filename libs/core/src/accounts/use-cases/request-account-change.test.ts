import { formatOptionId } from '../../inbox/option-id';
import { AccountReplyIntent, AccountState, AgentChangeStatus, CommandKind, MessageKind, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { askAndAbandon, receive, receiveText } from '../../inbox/testing/fixtures';
import { AGENT_CHANGE_APPROVAL_TIMEOUT_MS, APPROVAL_COOLDOWN_MS } from '../constants';
import { addAgent, agentRequestOf, createAccountFixture, PUBLIC_ORIGIN, sessionTexts, type AccountFixture } from '../testing/fixtures';
import { requestAccountChange } from './request-account-change';
import type { ApprovedCommandKind } from './types';

const OWNER_LOCALE = OwnerLocale.EnglishUs;
const OTHER_WA_ID = '14155550100';

function fixtureOf() {
  return createAccountFixture({ locale: OWNER_LOCALE });
}

function requestChange(input: AccountFixture & { kind: ApprovedCommandKind; rawName: string }) {
  return requestAccountChange({
    ...agentRequestOf(input),
    kind: input.kind,
    rawName: input.rawName,
    timeoutMs: AGENT_CHANGE_APPROVAL_TIMEOUT_MS,
  });
}

function choicesOf(input: AccountFixture) {
  return input.environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Choice ? [message] : []));
}

async function tap(input: AccountFixture & { title: string }): Promise<void> {
  await input.environment.clock.advance({ ms: 0 });
  const choice = choicesOf(input).at(-1)!;
  const option = choice.options.find((candidate) => candidate.title === input.title)!;
  await receive({
    environment: input.environment,
    ownerLocale: OWNER_LOCALE,
    content: {
      kind: MessageKind.Choice,
      optionId: formatOptionId({ questionId: choice.questionId, optionIndex: option.optionIndex }),
      optionTitle: option.title,
      optionDescription: null,
    },
  });
}

async function activeAgents(input: AccountFixture): Promise<string[]> {
  const active = await input.environment.registry.listActive({ accountId: input.account.accountId });
  return active.map((connection) => connection.agent);
}

describe('requestAccountChange connect', () => {
  test('asks the owner with three buttons from the calling agent and names the agent in the question', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'Helper' });
    await tap({ ...fixture, title: 'Deny' });
    await changing;
    const [choice] = choicesOf(fixture);
    const question = await fixture.environment.repository.findQuestion({ questionId: choice!.questionId });
    expect(choice!.options.map((option) => option.title)).toEqual(['Allow', 'Allow, send to agent', 'Deny']);
    expect(question!.agent).toBe('claude');
    expect(question!.text).toContain('claude wants to connect a new agent named helper');
  });

  test('Allow creates the agent and the install link goes to the owner only', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    const result = await changing;
    const [issued] = fixture.environment.secrets.issued;
    expect(result).toEqual({ status: AgentChangeStatus.Applied, intent: AccountReplyIntent.Created, agent: 'helper', installPrompt: null });
    expect(await activeAgents(fixture)).toEqual(['helper']);
    expect(sessionTexts(fixture).join('\n')).toContain(`${PUBLIC_ORIGIN}/i/`);
    expect(JSON.stringify(result)).not.toContain(issued!.secret);
  });

  test('Allow, send to agent returns the install prompt and sends nothing else to the owner', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow, send to agent' });
    const result = await changing;
    const [issued] = fixture.environment.secrets.issued;
    expect(result.status).toBe(AgentChangeStatus.Applied);
    expect(result.installPrompt).toContain(`${PUBLIC_ORIGIN}/i/`);
    expect(result.installPrompt).not.toContain(issued!.secret);
    expect(sessionTexts(fixture)).toEqual([]);
    expect(await activeAgents(fixture)).toEqual(['helper']);
  });

  test('Deny changes nothing', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Deny' });
    expect(await changing).toEqual({ status: AgentChangeStatus.Denied, intent: null, agent: 'helper', installPrompt: null });
    expect(await activeAgents(fixture)).toEqual([]);
    expect(fixture.environment.secrets.issued).toEqual([]);
  });

  test('no answer in time changes nothing, and a tap afterwards changes nothing either', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await fixture.environment.clock.advance({ ms: AGENT_CHANGE_APPROVAL_TIMEOUT_MS });
    expect(await changing).toEqual({ status: AgentChangeStatus.TimedOut, intent: null, agent: 'helper', installPrompt: null });
    await tap({ ...fixture, title: 'Allow' });
    expect(await activeAgents(fixture)).toEqual([]);
    expect(fixture.environment.secrets.issued).toEqual([]);
  });

  test('a repeated request is a new question, so an earlier approval is never replayed', async () => {
    const fixture = await fixtureOf();
    const first = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    await first;
    const revoking = requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    await revoking;
    const again = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await fixture.environment.clock.advance({ ms: 0 });
    expect(choicesOf(fixture)).toHaveLength(3);
    expect(await activeAgents(fixture)).toEqual([]);
    await tap({ ...fixture, title: 'Deny' });
    expect((await again).status).toBe(AgentChangeStatus.Denied);
  });

  test.each([
    { rawName: '!!!', intent: AccountReplyIntent.InvalidName },
    { rawName: 'ajuda', intent: AccountReplyIntent.ReservedName },
  ])('refuses the name $rawName without asking the owner', async ({ rawName, intent }) => {
    const fixture = await fixtureOf();
    const result = await requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName });
    expect(result.status).toBe(AgentChangeStatus.Refused);
    expect(result.intent).toBe(intent);
    expect(fixture.environment.sender.sessions).toEqual([]);
  });

  test('a taken name is refused after the tap by the same use case the commands run', async () => {
    const fixture = await fixtureOf();
    await addAgent({ ...fixture, agent: 'helper' });
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    const result = await changing;
    expect(result).toMatchObject({ status: AgentChangeStatus.Refused, intent: AccountReplyIntent.NameTaken, installPrompt: null });
  });

  test('revokes the new connection again and reports it when the install link cannot be sent', async () => {
    const fixture = await fixtureOf();
    fixture.environment.sender.failSessionCalls({ callNumbers: [2] });
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    expect(await changing).toMatchObject({ status: AgentChangeStatus.Refused, intent: AccountReplyIntent.SendFailed });
    expect(await activeAgents(fixture)).toEqual([]);
  });
});

describe('requestAccountChange revoke', () => {
  test('asks with two buttons and revokes only after Allow', async () => {
    const fixture = await fixtureOf();
    await addAgent({ ...fixture, agent: 'helper' });
    const changing = requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Deny' });
    expect((await changing).status).toBe(AgentChangeStatus.Denied);
    expect(choicesOf(fixture)[0]!.options.map((option) => option.title)).toEqual(['Allow', 'Deny']);
    expect(await activeAgents(fixture)).toEqual(['helper']);
    await fixture.environment.clock.advance({ ms: APPROVAL_COOLDOWN_MS });
    const revoking = requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Allow' });
    expect(await revoking).toEqual({
      status: AgentChangeStatus.Applied,
      intent: AccountReplyIntent.Revoked,
      agent: 'helper',
      installPrompt: null,
    });
    expect(await activeAgents(fixture)).toEqual([]);
  });

  test('an unknown agent is refused without asking the owner', async () => {
    const fixture = await fixtureOf();
    const result = await requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'ghost' });
    expect(result).toEqual({ status: AgentChangeStatus.Refused, intent: AccountReplyIntent.NotFound, agent: 'ghost', installPrompt: null });
    expect(fixture.environment.sender.sessions).toEqual([]);
  });

  test('never reaches an agent of another account', async () => {
    const fixture = await fixtureOf();
    const other = {
      environment: fixture.environment,
      account: await fixture.environment.openAccount({ accountId: 'acc_other', waId: OTHER_WA_ID }),
    };
    await addAgent({ ...other, agent: 'stranger' });
    const result = await requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'stranger' });
    expect(result.intent).toBe(AccountReplyIntent.NotFound);
    expect(await activeAgents(other)).toEqual(['stranger']);
  });
});

describe('requestAccountChange typed answers', () => {
  test.each([{ text: 'Allow, send to agent' }, { text: 'Allow' }, { text: 'yes please' }])(
    'a typed "$text" is denied and changes nothing',
    async ({ text }) => {
      const fixture = await fixtureOf();
      const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
      await fixture.environment.clock.advance({ ms: 0 });
      await receiveText({ environment: fixture.environment, text });
      expect(await changing).toEqual({ status: AgentChangeStatus.Denied, intent: null, agent: 'helper', installPrompt: null });
      expect(await activeAgents(fixture)).toEqual([]);
      expect(fixture.environment.secrets.issued).toEqual([]);
    },
  );

  test('a text meant for the question of another agent cannot approve', async () => {
    const fixture = await fixtureOf();
    await askAndAbandon({ environment: fixture.environment, agent: 'beta', text: 'Deploy?', options: ['Allow', 'Deny'] });
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await fixture.environment.clock.advance({ ms: 0 });
    await receiveText({ environment: fixture.environment, text: 'Allow' });
    expect((await changing).status).toBe(AgentChangeStatus.Denied);
    expect(await activeAgents(fixture)).toEqual([]);
  });
});

describe('requestAccountChange cooldown', () => {
  test('the same request is refused without a question for ten minutes after a Deny', async () => {
    const fixture = await fixtureOf();
    const first = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Deny' });
    await first;
    const again = await requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    expect(again).toMatchObject({ status: AgentChangeStatus.Refused, intent: AccountReplyIntent.CoolingDown });
    expect(choicesOf(fixture)).toHaveLength(1);
  });

  test('a timeout starts the cooldown, a different name is not held, and the cooldown ends', async () => {
    const fixture = await fixtureOf();
    const first = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await fixture.environment.clock.advance({ ms: AGENT_CHANGE_APPROVAL_TIMEOUT_MS });
    await first;
    const held = await requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    expect(held.intent).toBe(AccountReplyIntent.CoolingDown);
    const other = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'other' });
    await tap({ ...fixture, title: 'Deny' });
    expect((await other).status).toBe(AgentChangeStatus.Denied);
    await fixture.environment.clock.advance({ ms: APPROVAL_COOLDOWN_MS });
    const released = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Deny' });
    expect((await released).status).toBe(AgentChangeStatus.Denied);
  });

  test('another requester or another kind is not held', async () => {
    const fixture = await fixtureOf();
    await addAgent({ ...fixture, agent: 'helper' });
    const first = requestChange({ ...fixture, kind: CommandKind.RevokeAgent, rawName: 'helper' });
    await tap({ ...fixture, title: 'Deny' });
    await first;
    const create = requestAccountChange({
      ...agentRequestOf({ ...fixture, agent: 'beta' }),
      kind: CommandKind.RevokeAgent,
      rawName: 'helper',
      timeoutMs: AGENT_CHANGE_APPROVAL_TIMEOUT_MS,
    });
    await tap({ ...fixture, title: 'Deny' });
    expect((await create).status).toBe(AgentChangeStatus.Denied);
  });
});

describe('requestAccountChange account state', () => {
  test('an account suspended while the question was open is not changed by the tap', async () => {
    const fixture = await fixtureOf();
    const changing = requestChange({ ...fixture, kind: CommandKind.CreateAgent, rawName: 'helper' });
    await fixture.environment.clock.advance({ ms: 0 });
    await fixture.environment.directory.setState({ accountId: fixture.account.accountId, state: AccountState.Suspended });
    await tap({ ...fixture, title: 'Allow' });
    expect(await changing).toMatchObject({ status: AgentChangeStatus.Refused, intent: AccountReplyIntent.Suspended });
    expect(await activeAgents(fixture)).toEqual([]);
  });
});
