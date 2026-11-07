import { ChannelError, type Clock, type MediaStore } from '@zapbip/core';
import { ChannelErrorKind, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelRestrictions } from '../../src/adapters/d1/d1-channel-restrictions';
import { createCloudApiMessageSender } from '../../src/adapters/whatsapp/cloud-api-message-sender';
import { GRAPH_NO_RESPONSE_STATUS, GraphRequestError, type GraphClient } from '../../src/adapters/whatsapp/graph-client';
import { buildEnvelope, buildTextMessage } from '../support/builders';

const ACCOUNT_ID = 'acc_a';
const PHONE_NUMBER_ID = '1000000000000001';
const OWNER = { waId: '5511900000001', ownerLocale: OwnerLocale.PortugueseBrazil };
const NOW = 1_800_000_000_000;
const SENT_ID = 'wamid.SENT';

type RecordedPost = { path: string; body: Record<string, unknown> };

const mediaStore: MediaStore = {
  put: () => Promise.reject(new Error('unexpected put')),
  get: () => Promise.reject(new Error('unexpected get')),
  signedLink: () => Promise.resolve('exp=1&sig=abc'),
  delete: () => Promise.reject(new Error('unexpected delete')),
};

const clock: Clock = { now: () => NOW, schedule: () => ({ cancel: () => undefined }) };

function graphError(input: { status: number; errorCode: number | null }): GraphRequestError {
  return new GraphRequestError({ status: input.status, errorCode: input.errorCode, errorTitle: null, message: 'graph failed' });
}

function setup(input: { owner?: typeof OWNER | null; failWith?: GraphRequestError; restricted?: { errorCode: number } | null }) {
  const posts: RecordedPost[] = [];
  const graph: GraphClient = {
    post: vi.fn(async ({ path, body }) => {
      posts.push({ path, body: body as Record<string, unknown> });
      if (input.failWith !== undefined) throw input.failWith;
      return { messages: [{ id: SENT_ID }] };
    }),
    get: () => Promise.reject(new Error('unexpected get')),
    download: () => Promise.reject(new Error('unexpected download')),
  };
  const recorded: { errorCode: number; restrictedAt: number }[] = [];
  const restrictions: ChannelRestrictions = {
    findActive: vi.fn(async () => (input.restricted === undefined ? null : input.restricted)),
    record: vi.fn(async (entry) => {
      recorded.push(entry);
    }),
  };
  const indexed: { id: string; accountId: string; at: number }[] = [];
  const sender = createCloudApiMessageSender({
    accountId: ACCOUNT_ID,
    graph,
    findOwnerByAccountId: async () => (input.owner === undefined ? OWNER : input.owner),
    messageIndex: {
      record: async (entry) => {
        indexed.push(entry);
        return true;
      },
    },
    restrictions,
    mediaStore,
    publicOrigin: 'https://api.test',
    phoneNumberId: PHONE_NUMBER_ID,
    clock,
  });
  return { sender, posts, recorded, indexed, graph, restrictions };
}

function sessionInput(input: { message?: ReturnType<typeof buildTextMessage> } = {}) {
  return {
    message: input.message === undefined ? buildTextMessage({ messageId: 'msg_1', text: 'Olá' }) : input.message,
    question: null,
    replyToChannelMessageId: null,
    reactionTargetChannelMessageId: null,
  };
}

function templateInput(input: { locale?: OwnerLocale } = {}) {
  return {
    kind: TemplateKind.Notice,
    locale: input.locale === undefined ? OwnerLocale.PortugueseBrazil : input.locale,
    parameters: ['alpha', 'oi'],
  };
}

async function failureOf(input: { run: () => Promise<unknown> }): Promise<ChannelError> {
  const failure = await input.run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(ChannelError);
  return failure as ChannelError;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cloud API message sender session', () => {
  it('posts the payload to the phone number messages path and indexes the returned id', async () => {
    const { sender, posts, indexed } = setup({});
    expect(await sender.session(sessionInput())).toEqual({ channelMessageId: SENT_ID });
    expect(posts).toHaveLength(1);
    expect(posts[0]!.path).toBe(`/${PHONE_NUMBER_ID}/messages`);
    expect(posts[0]!.body).toMatchObject({ to: OWNER.waId, type: 'text', text: { body: 'Olá' } });
    expect(indexed).toEqual([{ id: SENT_ID, accountId: ACCOUNT_ID, at: NOW }]);
  });

  it('AU-123 fails delivery without a Graph call when the account has no owner', async () => {
    const { sender, graph } = setup({ owner: null });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.DeliveryFailed);
    expect(error.message).toContain('owner');
    expect(graph.post).not.toHaveBeenCalled();
  });

  it('uses the owner locale for the list copy', async () => {
    const { sender, posts } = setup({ owner: { waId: OWNER.waId, ownerLocale: OwnerLocale.EnglishUs } });
    await sender.session({
      ...sessionInput({
        message: {
          ...buildEnvelope({ messageId: 'msg_2' }),
          kind: MessageKind.Choice,
          questionId: 'qst_1',
          selected: null,
          options: ['A', 'B', 'C', 'D'].map((title, optionIndex) => ({ optionIndex, title, description: null })),
        },
      }),
      question: {
        questionId: 'qst_1',
        agent: 'alpha',
        text: 'Which?',
        options: [],
        normalizedKey: 'k',
        promptMessageId: 'msg_2',
        askedAt: NOW,
        answer: null,
      },
    });
    expect(posts[0]!.body).toMatchObject({ interactive: { action: { button: 'See options' } } });
  });

  it('WI-60 maps a rejected reaction and names reaction.message_id', async () => {
    const { sender } = setup({ failWith: graphError({ status: 400, errorCode: 131_009 }) });
    const error = await failureOf({
      run: () =>
        sender.session({
          ...sessionInput({
            message: { ...buildEnvelope({ messageId: 'msg_3' }), kind: MessageKind.Reaction, targetMessageId: 'msg_1', emoji: '👍' },
          }),
          reactionTargetChannelMessageId: 'wamid.T',
        }),
    });
    expect(error.code).toBe(ChannelErrorKind.ReactionRejected);
    expect(error.message).toContain('reaction.message_id');
  });

  it('WI-59 reports a closed window without recording a restriction or an index row', async () => {
    const { sender, recorded, indexed } = setup({ failWith: graphError({ status: 400, errorCode: 131_047 }) });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.WindowClosed);
    expect(error.errorCode).toBe(131_047);
    expect(recorded).toEqual([]);
    expect(indexed).toEqual([]);
  });

  it.each([131_048, 368])('WI-63 records the restriction and logs it when Graph returns %i', async (errorCode) => {
    const { sender, recorded } = setup({ failWith: graphError({ status: 400, errorCode }) });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.Restricted);
    expect(recorded).toEqual([{ errorCode, restrictedAt: NOW }]);
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0]![0]))).toEqual({ event: 'channel.restricted', error_code: errorCode });
  });

  it('WI-63 refuses a restricted account without a Graph call', async () => {
    const { sender, graph, restrictions } = setup({ restricted: { errorCode: 131_048 } });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.Restricted);
    expect(error.errorCode).toBe(131_048);
    expect(restrictions.findActive).toHaveBeenCalledWith({ now: NOW });
    expect(graph.post).not.toHaveBeenCalled();
  });

  it('WI-62 maps a rate limit without retrying', async () => {
    const { sender, posts, recorded } = setup({ failWith: graphError({ status: 400, errorCode: 130_429 }) });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.RateLimited);
    expect(posts).toHaveLength(1);
    expect(recorded).toEqual([]);
  });

  it('WI-66 maps a server error to timeout and logs it', async () => {
    const { sender } = setup({ failWith: graphError({ status: 500, errorCode: null }) });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.Timeout);
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0]![0]))).toEqual({ event: 'channel.timeout' });
  });

  it('maps a request that got no response to timeout', async () => {
    const { sender } = setup({ failWith: graphError({ status: GRAPH_NO_RESPONSE_STATUS, errorCode: null }) });
    expect((await failureOf({ run: () => sender.session(sessionInput()) })).code).toBe(ChannelErrorKind.Timeout);
  });

  it('WI-67 maps an auth error and logs it without the token', async () => {
    const { sender } = setup({ failWith: graphError({ status: 401, errorCode: 190 }) });
    const error = await failureOf({ run: () => sender.session(sessionInput()) });
    expect(error.code).toBe(ChannelErrorKind.Auth);
    const line = String(vi.mocked(console.error).mock.calls[0]![0]);
    expect(JSON.parse(line)).toEqual({ event: 'channel.auth', error_code: 190 });
    expect(line).not.toContain('test-access-token');
  });

  it('rethrows an error that did not come from Graph', async () => {
    const { sender, graph } = setup({});
    vi.mocked(graph.post).mockRejectedValueOnce(new Error('boom'));
    await expect(sender.session(sessionInput())).rejects.toThrow('boom');
  });

  it('refuses a response without a message id', async () => {
    const { sender, graph } = setup({});
    vi.mocked(graph.post).mockResolvedValueOnce({ messages: [] });
    await expect(sender.session(sessionInput())).rejects.toThrow();
  });
});

describe('cloud API message sender template', () => {
  it('AU-124 sends the template in the language of the locale', async () => {
    const { sender, posts, indexed } = setup({});
    expect(await sender.template(templateInput({ locale: OwnerLocale.EnglishUs }))).toEqual({ channelMessageId: SENT_ID });
    expect(posts[0]!.body).toMatchObject({ type: 'template', template: { language: { code: 'en_US' } } });
    expect(indexed).toHaveLength(1);
  });

  it('WI-69 maps an unknown code to template rejected and logs the template and language', async () => {
    const { sender } = setup({ failWith: graphError({ status: 400, errorCode: 132_000 }) });
    const error = await failureOf({ run: () => sender.template(templateInput()) });
    expect(error.code).toBe(ChannelErrorKind.TemplateRejected);
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0]![0]))).toEqual({
      event: 'channel.template_rejected',
      error_code: 132_000,
      template_name: 'zapbip_agent_notice',
      language_code: 'pt_BR',
    });
  });

  it('keeps the table row over the template default for a restriction', async () => {
    const { sender, recorded } = setup({ failWith: graphError({ status: 400, errorCode: 131_048 }) });
    const error = await failureOf({ run: () => sender.template(templateInput()) });
    expect(error.code).toBe(ChannelErrorKind.Restricted);
    expect(recorded).toHaveLength(1);
  });

  it('A32 refuses a restricted account before building the template', async () => {
    const { sender, graph } = setup({ restricted: { errorCode: 368 } });
    const error = await failureOf({ run: () => sender.template({ ...templateInput(), parameters: ['only-one'] }) });
    expect(error.code).toBe(ChannelErrorKind.Restricted);
    expect(graph.post).not.toHaveBeenCalled();
  });

  it('fails delivery without a Graph call when the account has no owner', async () => {
    const { sender, graph } = setup({ owner: null });
    expect((await failureOf({ run: () => sender.template(templateInput()) })).code).toBe(ChannelErrorKind.DeliveryFailed);
    expect(graph.post).not.toHaveBeenCalled();
  });
});
