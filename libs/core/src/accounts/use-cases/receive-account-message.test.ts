import {
  AccountReplyIntent,
  AccountReplyParameter,
  AccountState,
  ChannelErrorKind,
  CommandKind,
  MessageDirection,
  MessageKind,
  OwnerLocale,
  ReplyKind,
  DAY_MS,
  MINUTE_MS,
} from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { DELETION_CONFIRM_TTL_MS, ACCOUNT_MENU_QUESTION_ID } from '../constants';
import { renderAccountReply } from '../account-copy';
import { channelError } from '../../inbox/testing/channel-fixtures';
import { askAndAbandon } from '../../inbox/testing/fixtures';
import { openWindow } from '../../inbox/use-cases/open-window';
import { sendText } from '../../inbox/use-cases/send-text';
import { touchAgent } from '../../inbox/use-cases/touch-agent';
import {
  addAgent,
  createAccountFixture,
  PUBLIC_ORIGIN,
  receiveAccount,
  receiveAccountText,
  receiveListTap,
  sessionTexts,
  UNITED_STATES_WA_ID,
  type AccountFixture,
} from '../testing/fixtures';

function copyOf(input: {
  intent: AccountReplyIntent;
  locale?: OwnerLocale;
  parameters?: Partial<Record<AccountReplyParameter, string>>;
}): string {
  const { intent, locale = OwnerLocale.PortugueseBrazil, parameters = {} } = input;
  return renderAccountReply({ reply: { intent, kind: ReplyKind.Text, locale, parameters, menuRows: [] } });
}

async function storedOwnerMessages(input: AccountFixture) {
  const held = await input.environment.repository.listHeld();
  const history = await input.environment.repository.listAgentHistory({ agent: 'claude', limit: 50 });
  return [...held, ...history].filter((message) => message.direction === MessageDirection.FromOwner);
}

async function agentWrites(input: AccountFixture & { agent: string }) {
  await touchAgent({ dependencies: input.environment.dependencies, agent: input.agent });
  return sendText({
    dependencies: input.environment.dependencies,
    connection: { accountId: input.account.accountId, agent: input.agent, ownerLocale: OwnerLocale.PortugueseBrazil },
    text: 'done',
    replyToMessageId: null,
  });
}

describe('receiveAccountMessage rule 0', () => {
  test('agentes answers with the empty list and leaves an open question alone', async () => {
    const fixture = await createAccountFixture();
    const question = await askAndAbandon({ environment: fixture.environment });
    const result = await receiveAccountText({ ...fixture, text: 'agentes' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture).at(-1)).toBe(copyOf({ intent: AccountReplyIntent.EmptyList }));
    expect((await fixture.environment.repository.findQuestion({ questionId: question.questionId }))!.answer).toBeNull();
  });

  test('a command does not change the last agent that wrote', async () => {
    const fixture = await createAccountFixture();
    await agentWrites({ ...fixture, agent: 'alpha' });
    await receiveAccountText({ ...fixture, text: 'agentes' });
    const result = await receiveAccountText({ ...fixture, text: 'oi' });
    expect(result.agent).toBe('alpha');
  });

  test('a command word quoting an agent message is routed to that agent', async () => {
    const fixture = await createAccountFixture();
    const sent = await agentWrites({ ...fixture, agent: 'alpha' });
    const result = await receiveAccountText({ ...fixture, text: 'agentes', replyToMessageId: sent.messageId });
    expect(result.messageId).not.toBeNull();
    expect(result.agent).toBe('alpha');
  });

  test('a list tap on the list row runs the command', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveListTap({ ...fixture, optionId: 'zapbip:list_agents' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.EmptyList })]);
  });

  test('a button answer to a question is not a command', async () => {
    const fixture = await createAccountFixture();
    const question = await askAndAbandon({ environment: fixture.environment });
    const result = await receiveListTap({ ...fixture, optionId: `${question.questionId}:0` });
    expect(result.agent).toBe(question.agent);
  });

  test('an unknown zapbip id replies unknown', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveListTap({ ...fixture, optionId: 'zapbip:bogus' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.Unknown })]);
  });

  test('the confirm deletion id is not a command', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveListTap({ ...fixture, optionId: 'zapbip:confirm_deletion' });
    expect(result.deletionConfirmed).toBe(false);
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.Unknown })]);
  });

  test('a menu list tap replies in the account locale', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.EnglishUs, waId: UNITED_STATES_WA_ID });
    await receiveListTap({ ...fixture, optionId: 'zapbip:create_agent' });
    expect(sessionTexts(fixture)).toEqual([
      copyOf({
        intent: AccountReplyIntent.Usage,
        locale: OwnerLocale.EnglishUs,
        parameters: { [AccountReplyParameter.Usage]: 'new agent <name>' },
      }),
    ]);
  });

  test('help sends the text and then the interactive list', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'ajuda' });
    const [text, list] = fixture.environment.sender.sessions;
    expect(text!.kind).toBe(MessageKind.Text);
    if (list!.kind !== MessageKind.Choice) throw new Error('expected a list');
    expect(list!.questionId).toBe(ACCOUNT_MENU_QUESTION_ID);
    expect(list!.options).toHaveLength(7);
  });

  test('the same delivery twice sends nothing new', async () => {
    const fixture = await createAccountFixture();
    await receiveAccount({ ...fixture, content: { kind: MessageKind.Text, text: 'agentes' }, channelMessageId: 'wamid.same' });
    const second = await receiveAccount({
      ...fixture,
      content: { kind: MessageKind.Text, text: 'agentes' },
      channelMessageId: 'wamid.same',
    });
    expect(second.duplicate).toBe(true);
    expect(fixture.environment.sender.sessions).toHaveLength(1);
  });

  test('renovar a imagem is read as a rotate and is not routed', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'renovar a imagem' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.NotFound })]);
  });

  test('the mention form routes the words to the agent', async () => {
    const fixture = await createAccountFixture();
    await touchAgent({ dependencies: fixture.environment.dependencies, agent: 'claude' });
    const result = await receiveAccountText({ ...fixture, text: '@claude renovar a imagem' });
    expect(result.agent).toBe('claude');
    expect((await storedOwnerMessages(fixture)).map((message) => (message.kind === MessageKind.Text ? message.text : null))).toEqual([
      'renovar a imagem',
    ]);
  });

  test('a keyword in English answers in English although the account is pt_BR', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'revoke' });
    expect(sessionTexts(fixture)[0]).toContain('revoke <name>');
  });
});

describe('receiveAccountMessage account states', () => {
  test('a waitlisted account gets the onboarding reply and nothing is stored', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    const result = await receiveAccountText({ ...fixture, text: 'oi' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toHaveLength(1);
    expect(await storedOwnerMessages(fixture)).toEqual([]);
  });

  test('the onboarding reply carries the setup and request-access links of the owner language', async () => {
    const portuguese = await createAccountFixture({ state: AccountState.Waitlisted, locale: OwnerLocale.PortugueseBrazil });
    const english = await createAccountFixture({
      state: AccountState.Waitlisted,
      locale: OwnerLocale.EnglishUs,
      waId: UNITED_STATES_WA_ID,
    });
    await receiveAccountText({ ...portuguese, text: 'oi' });
    await receiveAccountText({ ...english, text: 'hi' });
    const [portugueseText] = sessionTexts(portuguese);
    const [englishText] = sessionTexts(english);
    expect(portugueseText).toContain('https://docs.zapbip.com/pt-br/get-started/how-to-start');
    expect(portugueseText).toContain('https://zapbip.com/pt-br');
    expect(englishText).toContain('https://docs.zapbip.com/get-started/how-to-start');
    expect(englishText).toContain('https://zapbip.com');
    expect(englishText).not.toContain('/pt-br');
  });

  test('a second message inside the cooldown gets no second onboarding reply', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    await receiveAccountText({ ...fixture, text: 'oi' });
    const result = await receiveAccountText({ ...fixture, text: 'tem alguém aí?' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toHaveLength(1);
  });

  test('a command inside the cooldown is still answered', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    await receiveAccountText({ ...fixture, text: 'oi' });
    await receiveAccountText({ ...fixture, text: 'ajuda' });
    expect(sessionTexts(fixture)).toHaveLength(2);
  });

  test('the onboarding reply comes again after the cooldown', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    await receiveAccountText({ ...fixture, text: 'oi' });
    await fixture.environment.clock.advance({ ms: DAY_MS + MINUTE_MS });
    await receiveAccountText({ ...fixture, text: 'oi de novo' });
    expect(sessionTexts(fixture)).toHaveLength(2);
  });

  test('a redelivered message does not start the cooldown a second time', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    await receiveAccountText({ ...fixture, text: 'oi', channelMessageId: 'wamid.onboarding.same' });
    await fixture.environment.clock.advance({ ms: DAY_MS - MINUTE_MS });
    await receiveAccountText({ ...fixture, text: 'oi', channelMessageId: 'wamid.onboarding.same' });
    await fixture.environment.clock.advance({ ms: 2 * MINUTE_MS });
    await receiveAccountText({ ...fixture, text: 'oi de novo' });
    expect(sessionTexts(fixture)).toHaveLength(2);
  });

  test('a suspended account gets the suspended reply on every message', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Suspended });
    await receiveAccountText({ ...fixture, text: 'oi' });
    await receiveAccountText({ ...fixture, text: 'ajuda' });
    expect(sessionTexts(fixture)).toEqual([
      copyOf({ intent: AccountReplyIntent.Suspended }),
      copyOf({ intent: AccountReplyIntent.Suspended }),
    ]);
  });

  test('a deleting account sends nothing', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Deleting });
    const result = await receiveAccountText({ ...fixture, text: 'oi' });
    expect(result.duplicate).toBe(false);
    expect(fixture.environment.sender.sessions).toEqual([]);
  });

  test('a first non-text message of an active account gets unknown and is not stored', async () => {
    const fixture = await createAccountFixture({ claimsFirstMessage: false });
    const content = { kind: MessageKind.Location as const, latitude: 1, longitude: 2, name: null, address: null };
    const result = await receiveAccount({ ...fixture, content, channelMessageId: 'wamid.first' });
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.Unknown })]);
    expect(await storedOwnerMessages(fixture)).toEqual([]);
  });

  test('a second non-text message is routed and stored', async () => {
    const fixture = await createAccountFixture({ claimsFirstMessage: false });
    await touchAgent({ dependencies: fixture.environment.dependencies, agent: 'claude' });
    const content = { kind: MessageKind.Location as const, latitude: 1, longitude: 2, name: null, address: null };
    await receiveAccount({ ...fixture, content });
    const second = await receiveAccount({ ...fixture, content });
    expect(second.messageId).not.toBeNull();
  });

  test('plain text with no agents holds the message (rule 6)', async () => {
    const fixture = await createAccountFixture();
    const first = await receiveAccountText({ ...fixture, text: 'oi' });
    expect(first.messageId).not.toBeNull();
    expect(first.agent).toBeNull();
  });
});

describe('receiveAccountMessage deletion', () => {
  test('[row 151] confirming without a request replies expired', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    expect(result.deletionConfirmed).toBe(false);
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.DeletionExpired })]);
  });

  test('[row 152] confirming exactly at the time to live is accepted', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    await fixture.environment.clock.advance({ ms: DELETION_CONFIRM_TTL_MS });
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    expect(result.deletionConfirmed).toBe(true);
    expect(sessionTexts(fixture).at(-1)).toBe(copyOf({ intent: AccountReplyIntent.DeletionDone }));
  });

  test('[row 153] confirming one millisecond late is refused and clears the request', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    await fixture.environment.clock.advance({ ms: DELETION_CONFIRM_TTL_MS + 1 });
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    expect(result.deletionConfirmed).toBe(false);
    expect(sessionTexts(fixture).at(-1)).toBe(copyOf({ intent: AccountReplyIntent.DeletionExpired }));
    expect(await fixture.environment.dependencies.deletionRequests.find()).toBeNull();
  });

  test('[row 154] a waitlisted account may confirm its deletion', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Waitlisted });
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    await fixture.environment.clock.advance({ ms: MINUTE_MS });
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    expect(result.deletionConfirmed).toBe(true);
  });

  test('a confirmed deletion moves the account to deleting before the reply is sent', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    const record = await fixture.environment.directory.findByWaId({ waId: fixture.account.waId });
    expect(record?.state).toBe(AccountState.Deleting);
  });

  test('a redelivery after a failed state change still confirms the deletion', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    const { dependencies } = fixture.environment;
    const accounts = dependencies.accounts;
    const setState = vi.fn(accounts.setState).mockRejectedValueOnce(new Error('directory unavailable'));
    dependencies.accounts = { ...accounts, setState };
    const channelMessageId = 'wamid.confirm.redelivered';
    await expect(receiveAccountText({ ...fixture, text: 'apagar conta definitivamente', channelMessageId })).rejects.toThrow(
      'directory unavailable',
    );
    const retried = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente', channelMessageId });
    expect(retried.deletionConfirmed).toBe(true);
    expect(sessionTexts(fixture).at(-1)).toBe(copyOf({ intent: AccountReplyIntent.DeletionDone }));
  });

  test('a request that expires while the state change runs is still confirmed', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    await fixture.environment.clock.advance({ ms: DELETION_CONFIRM_TTL_MS });
    const { dependencies, clock } = fixture.environment;
    const accounts = dependencies.accounts;
    const setState = vi.fn(async (input: Parameters<typeof accounts.setState>[0]) => {
      await clock.advance({ ms: 1 });
      return accounts.setState(input);
    });
    dependencies.accounts = { ...accounts, setState };
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    const record = await fixture.environment.directory.findByWaId({ waId: fixture.account.waId });
    expect(record?.state).toBe(AccountState.Deleting);
    expect(result.deletionConfirmed).toBe(true);
    expect(sessionTexts(fixture).at(-1)).toBe(copyOf({ intent: AccountReplyIntent.DeletionDone }));
  });

  test('a suspended account cannot confirm its deletion', async () => {
    const fixture = await createAccountFixture({ state: AccountState.Suspended });
    const result = await receiveAccountText({ ...fixture, text: 'apagar conta definitivamente' });
    expect(result.deletionConfirmed).toBe(false);
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.Suspended })]);
  });
});

describe('receiveAccountMessage compensation', () => {
  test('a failed create send revokes the new link and tells the owner', async () => {
    const fixture = await createAccountFixture();
    fixture.environment.sender.failSessionCalls({ callNumbers: [1] });
    const result = await receiveAccountText({ ...fixture, text: 'novo agente claude' });
    const [issued] = fixture.environment.secrets.issued;
    expect(result.duplicate).toBe(false);
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: issued!.digest })).toBeNull();
    expect(await fixture.environment.registry.listActive({ accountId: fixture.account.accountId })).toEqual([]);
    expect(sessionTexts(fixture)).toEqual([copyOf({ intent: AccountReplyIntent.SendFailed })]);
  });

  test('a failed rotate send restores the old link and its install code and keeps the waiters', async () => {
    const fixture = await createAccountFixture();
    const oldDigest = await addAgent({ ...fixture, agent: 'claude' });
    const before = await fixture.environment.registry.findActiveByAgent({ accountId: fixture.account.accountId, agent: 'claude' });
    fixture.environment.sender.failSessionCalls({ callNumbers: [1] });
    await receiveAccountText({ ...fixture, text: 'renovar claude' });
    const [, rotated] = fixture.environment.secrets.issued;
    const after = await fixture.environment.registry.findActiveByAgent({ accountId: fixture.account.accountId, agent: 'claude' });
    expect(after).toEqual(before);
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: oldDigest })).not.toBeNull();
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: rotated!.digest })).toBeNull();
    expect(fixture.environment.revocations.cancelled).toEqual([]);
    expect(fixture.environment.revocations.closed).toEqual([]);
  });

  test('a failed rotate of an agent created through the command restores its real install code columns', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'novo agente claude' });
    const { accountId } = fixture.account;
    const before = await fixture.environment.registry.findActiveByAgent({ accountId, agent: 'claude' });
    expect(before?.installCodeDigest).not.toBeNull();
    expect(before?.installCodeSealedSecret).not.toBeNull();
    expect(before?.installCodeExpiresAt).not.toBeNull();
    fixture.environment.sender.failSessionCalls({ callNumbers: [2] });
    await receiveAccountText({ ...fixture, text: 'renovar claude' });
    const after = await fixture.environment.registry.findActiveByAgent({ accountId, agent: 'claude' });
    expect(after).toEqual(before);
  });

  test('a delivered rotate cancels the waiters of that agent only', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await receiveAccountText({ ...fixture, text: 'renovar claude' });
    expect(fixture.environment.revocations.cancelled).toEqual(['claude']);
    expect(fixture.environment.revocations.revoked).toEqual([]);
  });

  test('a delivered rotate closes the connector sockets of that agent only', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await receiveAccountText({ ...fixture, text: 'renovar claude' });
    expect(fixture.environment.revocations.closed).toEqual(['claude']);
  });

  test('a delivered rotate hands the new key digest to the object', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await receiveAccountText({ ...fixture, text: 'renovar claude' });
    const newDigest = fixture.environment.secrets.issued.at(-1)?.digest;
    expect(fixture.environment.revocations.rotated).toEqual([{ agent: 'claude', secretDigest: newDigest }]);
  });

  test('a delivered create sends one text with the install link and no part label', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'novo agente claude' });
    const [installCode] = fixture.environment.installCodeVault.issued;
    expect(result.messageId).toBeNull();
    expect(sessionTexts(fixture)).toHaveLength(1);
    expect(sessionTexts(fixture)[0]).toContain(`${PUBLIC_ORIGIN}/i/${installCode!.installCode}`);
    expect(sessionTexts(fixture)[0]).not.toMatch(/^1\/\d/);
  });
});

describe('receiveAccountMessage command facts', () => {
  test('create reports its kind and the new connection id', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'novo agente alpha' });
    expect(result.commandKind).toBe(CommandKind.CreateAgent);
    expect(result.connectionId).toMatch(/^con_/);
  });

  test('revoke reports the revoked connection id and rotate the same id', async () => {
    const fixture = await createAccountFixture();
    const created = await receiveAccountText({ ...fixture, text: 'novo agente alpha' });
    const rotated = await receiveAccountText({ ...fixture, text: 'renovar alpha' });
    const revoked = await receiveAccountText({ ...fixture, text: 'revogar alpha' });
    expect([rotated.commandKind, revoked.commandKind]).toEqual([CommandKind.RotateAgent, CommandKind.RevokeAgent]);
    expect([rotated.connectionId, revoked.connectionId]).toEqual([created.connectionId, created.connectionId]);
  });

  test('a plain message reports no command and no connection', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'bom dia' });
    expect([result.commandKind, result.connectionId]).toEqual([null, null]);
  });

  test('a refused command reports its kind and no connection', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'revogar ninguem' });
    expect([result.commandKind, result.connectionId]).toEqual([CommandKind.RevokeAgent, null]);
  });
});

describe('receiveAccountMessage menu locale', () => {
  test.each([OwnerLocale.PortugueseBrazil, OwnerLocale.EnglishUs])('menu answers an %s account in its own locale', async (locale) => {
    const fixture = await createAccountFixture({ locale });
    await receiveAccountText({ ...fixture, text: 'menu' });
    const expected = renderAccountReply({
      reply: { intent: AccountReplyIntent.Menu, kind: ReplyKind.List, locale, parameters: {}, menuRows: [] },
    });
    expect(sessionTexts(fixture).at(-1)).toBe(expected);
  });
});

describe('receiveAccountMessage connection creation', () => {
  test('creating an agent tells the object that the name is live again', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'novo agente alpha' });
    expect(fixture.environment.revocations.created).toEqual(['alpha']);
  });
});

describe('receiveAccountMessage forwarded messages', () => {
  test('a forwarded account command is plain text, never a command', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'alpha' });
    const result = await receiveAccount({ ...fixture, forwarded: true, content: { kind: MessageKind.Text, text: 'revogar alpha' } });
    expect(result.commandKind).toBeNull();
    expect(result.deletionConfirmed).toBe(false);
    const connections = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
    expect(connections.map((connection) => connection.agent)).toEqual(['alpha']);
  });

  test('a forwarded deletion confirmation does not delete the account', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'apagar conta' });
    const result = await receiveAccount({
      ...fixture,
      forwarded: true,
      content: { kind: MessageKind.Text, text: 'apagar conta definitivamente' },
    });
    expect(result.deletionConfirmed).toBe(false);
    const record = await fixture.environment.directory.findByWaId({ waId: fixture.account.waId });
    expect(record?.state).toBe(AccountState.Active);
  });

  test('a typed command still works', async () => {
    const fixture = await createAccountFixture();
    const result = await receiveAccountText({ ...fixture, text: 'novo agente beta' });
    expect(result.commandKind).toBe(CommandKind.CreateAgent);
  });
});

describe('receiveAccountMessage install link redaction', () => {
  function sentMessageIds(input: AccountFixture): string[] {
    return input.environment.sender.sessions.map((message) => message.messageId);
  }

  test('[row 486] masks by id the replies that reached sent', async () => {
    const fixture = await createAccountFixture();
    await receiveAccountText({ ...fixture, text: 'novo agente claude' });
    expect(fixture.environment.installLinkRedaction.redacted).toEqual(sentMessageIds(fixture));
    expect(fixture.environment.installLinkRedaction.redacted).toHaveLength(1);
  });

  test('keeps a queued reply unmasked and carrying the real link until it is sent', async () => {
    const fixture = await createAccountFixture();
    fixture.environment.sender.failSessionCalls({ callNumbers: [1], error: channelError({ kind: ChannelErrorKind.WindowClosed }) });
    await receiveAccountText({ ...fixture, text: 'novo agente claude' });
    expect(fixture.environment.installLinkRedaction.redacted).toEqual([]);
    await openWindow({
      dependencies: fixture.environment.dependencies,
      ownerLocale: fixture.account.locale,
      at: fixture.environment.clock.now(),
    });
    const [installCode] = fixture.environment.installCodeVault.issued;
    expect(sessionTexts(fixture)[0]).toContain(`${PUBLIC_ORIGIN}/i/${installCode!.installCode}`);
  });

  test('masks the replies already sent when a later send throws', async () => {
    const fixture = await createAccountFixture();
    fixture.environment.sender.failSessionCalls({ callNumbers: [2] });
    await receiveAccountText({ ...fixture, text: 'ajuda' });
    const [firstSentMessageId] = sentMessageIds(fixture);
    expect(fixture.environment.installLinkRedaction.redacted).toEqual([firstSentMessageId]);
  });
});
