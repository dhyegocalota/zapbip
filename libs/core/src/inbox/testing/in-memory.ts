import {
  DAY_MS,
  DeliveryState,
  IdPrefix,
  MessageDirection,
  WakeOutcome,
  type AgentWakeReason,
  type OwnerLocale,
  type TemplateKind,
} from '@zapbip/types';
import { QUEUE_RETENTION_MS, QUESTION_RETENTION_MS, RECEIPT_RETENTION_MS } from '../constants';
import type { AgentName } from '../connection';
import type { AgentRecord, ChannelStatusDetail, OwnerWindow, StoredMedia } from '../inbox-records';
import type { Message } from '../message';
import type { AgentWaker, Clock, CoreDependencies, IdGenerator, InboxRepository, MediaStore, MessageSender } from '../ports';
import type { Question } from '../question';
import { createReplyWaiters } from '../waiters';
import { createFakeClock, type FakeClock } from './fake-clock';

const DEFAULT_ACCOUNT_ID = 'account_1';
const DEFAULT_START_AT = 10 * DAY_MS;
const FAKE_SIGNATURE = 'fake';

export type SentTemplate = { kind: TemplateKind; locale: OwnerLocale; parameters: string[] };
export type WakeNotification = { agent: AgentName; reason: AgentWakeReason };

export type RecordingSender = MessageSender & {
  sessions: Message[];
  templates: SentTemplate[];
  failSessionCalls(input: { callNumbers: number[] }): void;
  failTemplateCalls(input: { callNumbers: number[] }): void;
  holdTemplates(): void;
  releaseTemplates(): void;
};

export type RecordingWaker = AgentWaker & {
  notifications: WakeNotification[];
  replyWith(input: { outcome: WakeOutcome }): void;
};

export type InMemoryRepository = InboxRepository & {
  findStatusDetail(input: { messageId: string }): ChannelStatusDetail | null;
  findClaimedAt(input: { messageId: string }): number | null;
};

export type InMemoryMediaStore = MediaStore & {
  hasObject(input: { mediaId: string }): boolean;
};

export type InMemoryOptions = { accountId?: string; startAt?: number };

export type InMemoryEnvironment = {
  dependencies: CoreDependencies;
  clock: FakeClock;
  repository: InMemoryRepository;
  sender: RecordingSender;
  waker: RecordingWaker;
  mediaStore: InMemoryMediaStore;
};

function createInMemoryRepository(): InMemoryRepository {
  const agents = new Map<AgentName, AgentRecord>();
  const receipts = new Map<string, number>();
  const media = new Map<string, StoredMedia>();
  let messages: Message[] = [];
  let questions: Question[] = [];
  let window: OwnerWindow = { lastOwnerMessageAt: null, noticeSentForClosedWindow: false, closedAt: null };

  function replaceMessages(input: { messageIds: string[]; change: (message: Message) => Message }): void {
    messages = messages.map((message) => (input.messageIds.includes(message.messageId) ? input.change(message) : message));
  }

  function replaceQuestion(input: { questionId: string; change: (question: Question) => Question }): void {
    questions = questions.map((question) => (question.questionId === input.questionId ? input.change(question) : question));
  }

  const unreadOf = (agent: AgentName): Message[] =>
    messages.filter((message) => message.direction === MessageDirection.FromOwner && message.agent === agent && !message.readByAgent);

  return {
    findStatusDetail: (input) => {
      void input;
      throw new Error('findStatusDetail is not implemented');
    },
    findClaimedAt: (input) => {
      void input;
      throw new Error('findClaimedAt is not implemented');
    },
    registerAgent: async ({ agent, seenAt }) => {
      agents.set(agent, { agent, lastSeenAt: seenAt });
    },
    listAgents: async () => [...agents.values()],
    insertMessage: async ({ message }) => {
      messages = [...messages, message];
    },
    updateDelivery: async ({ messageId, delivery }) =>
      replaceMessages({ messageIds: [messageId], change: (message) => ({ ...message, delivery }) }),
    findMessage: async ({ messageId }) => messages.find((message) => message.messageId === messageId) ?? null,
    listAgentHistory: async ({ agent, limit }) => messages.filter((message) => message.agent === agent).slice(-limit),
    listUnread: async ({ agent, limit }) => unreadOf(agent).slice(0, limit),
    countUnread: async ({ agent }) => unreadOf(agent).length,
    markRead: async ({ messageIds }) => replaceMessages({ messageIds, change: (message) => ({ ...message, readByAgent: true }) }),
    listHeld: async () => messages.filter((message) => message.direction === MessageDirection.FromOwner && message.agent === null),
    assignAgent: async ({ messageIds, agent }) => replaceMessages({ messageIds, change: (message) => ({ ...message, agent }) }),
    listQueued: async () => messages.filter((message) => message.delivery === DeliveryState.Queued),
    findLastAgentWrite: async ({ since }) => {
      const written = messages.filter(
        (message) => message.direction === MessageDirection.ToOwner && message.agent !== null && message.at >= since,
      );
      const last = written.at(-1);
      return last === undefined ? null : last.agent;
    },
    insertQuestion: async ({ question }) => {
      questions = [...questions, question];
    },
    findQuestion: async ({ questionId }) => questions.find((question) => question.questionId === questionId) ?? null,
    findRecentQuestion: async ({ agent, normalizedKey, askedAfter }) =>
      questions.findLast(
        (question) => question.agent === agent && question.normalizedKey === normalizedKey && question.askedAt >= askedAfter,
      ) ?? null,
    listOpenQuestions: async () => questions.filter((question) => question.answer === null).reverse(),
    saveAnswer: async ({ questionId, answer }) => replaceQuestion({ questionId, change: (question) => ({ ...question, answer }) }),
    recordChannelReceipt: async ({ wamid, receivedAt }) => {
      if (receipts.has(wamid)) return false;
      receipts.set(wamid, receivedAt);
      return true;
    },
    deleteExpiredReceipts: async ({ receivedBefore }) => {
      [...receipts].filter(([, receivedAt]) => receivedAt < receivedBefore).forEach(([wamid]) => receipts.delete(wamid));
    },
    commitChannelInbound: async (input) => {
      void input;
      throw new Error('commitChannelInbound is not implemented');
    },
    saveChannelMessageId: async (input) => {
      void input;
      throw new Error('saveChannelMessageId is not implemented');
    },
    findMessageByChannelMessageId: async (input) => {
      void input;
      throw new Error('findMessageByChannelMessageId is not implemented');
    },
    findChannelMessageId: async (input) => {
      void input;
      throw new Error('findChannelMessageId is not implemented');
    },
    saveChannelStatusDetail: async (input) => {
      void input;
      throw new Error('saveChannelStatusDetail is not implemented');
    },
    claimQueuedMessages: async (input) => {
      void input;
      throw new Error('claimQueuedMessages is not implemented');
    },
    releaseStaleClaims: async (input) => {
      void input;
      throw new Error('releaseStaleClaims is not implemented');
    },
    deleteQuestionsAskedBefore: async ({ askedBefore }) => {
      questions = questions.filter((question) => question.askedAt >= askedBefore);
    },
    findWindow: async () => ({ ...window }),
    saveWindow: async (input) => {
      window = { ...input.window };
    },
    claimNotice: async () => {
      if (window.noticeSentForClosedWindow) return false;
      window = { ...window, noticeSentForClosedWindow: true };
      return true;
    },
    insertMedia: async ({ media: stored }) => {
      media.set(stored.mediaId, stored);
    },
    findMedia: async ({ mediaId }) => media.get(mediaId) ?? null,
    markMediaReceived: async ({ mediaId, receivedAt, retentionUntil }) => {
      const stored = media.get(mediaId);
      if (stored === undefined) return;
      media.set(mediaId, { ...stored, receivedAt, retentionUntil, expiresAt: null });
    },
    listExpiredMediaIds: async ({ now }) =>
      [...media.values()]
        .filter(
          (stored) =>
            (stored.expiresAt !== null && stored.expiresAt <= now) || (stored.retentionUntil !== null && stored.retentionUntil <= now),
        )
        .map((stored) => stored.mediaId),
    deleteMedia: async ({ mediaIds }) => {
      mediaIds.forEach((mediaId) => media.delete(mediaId));
    },
    findNextExpiry: async () => {
      const dueTimes = [
        ...[...media.values()].flatMap((stored) => [stored.expiresAt, stored.retentionUntil]),
        ...messages.filter((message) => message.delivery === DeliveryState.Queued).map((message) => message.at + QUEUE_RETENTION_MS),
        ...questions.map((question) => question.askedAt + QUESTION_RETENTION_MS),
        ...[...receipts.values()].map((receivedAt) => receivedAt + RECEIPT_RETENTION_MS),
      ].filter((dueTime): dueTime is number => dueTime !== null);
      return dueTimes.length === 0 ? null : Math.min(...dueTimes);
    },
  };
}

function createRecordingSender(): RecordingSender {
  const sessions: Message[] = [];
  const templates: SentTemplate[] = [];
  let sessionCalls = 0;
  let templateCalls = 0;
  let failingSessionCalls: number[] = [];
  let failingTemplateCalls: number[] = [];
  let templateGate: Promise<void> | null = null;
  let openTemplateGate: () => void = () => undefined;

  return {
    sessions,
    templates,
    failSessionCalls: ({ callNumbers }) => {
      failingSessionCalls = callNumbers;
    },
    failTemplateCalls: ({ callNumbers }) => {
      failingTemplateCalls = callNumbers;
    },
    holdTemplates: () => {
      templateGate = new Promise((resolve) => {
        openTemplateGate = resolve;
      });
    },
    releaseTemplates: () => openTemplateGate(),
    session: async ({ message }) => {
      sessionCalls += 1;
      if (failingSessionCalls.includes(sessionCalls)) throw new Error('session failed');
      sessions.push(message);
      return { channelMessageId: `wamid.session.${sessionCalls}` };
    },
    template: async ({ kind, locale, parameters }) => {
      templateCalls += 1;
      const callNumber = templateCalls;
      templates.push({ kind, locale, parameters });
      await templateGate;
      if (failingTemplateCalls.includes(callNumber)) throw new Error('template failed');
      return { channelMessageId: `wamid.template.${callNumber}` };
    },
  };
}

function createRecordingWaker(): RecordingWaker {
  const notifications: WakeNotification[] = [];
  let outcome = WakeOutcome.Unreached;
  return {
    notifications,
    replyWith: (input) => {
      outcome = input.outcome;
    },
    notify: async ({ agent, reason }) => {
      notifications.push({ agent, reason });
      return outcome;
    },
  };
}

function createInMemoryMediaStore(input: { accountId: string; clock: Clock }): InMemoryMediaStore {
  const objects = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  const keyOf = (keyInput: { accountId: string; mediaId: string }): string => `${keyInput.accountId}/${keyInput.mediaId}`;

  return {
    hasObject: ({ mediaId }) => objects.has(keyOf({ accountId: input.accountId, mediaId })),
    put: async ({ accountId, mediaId, body, mimeType }) => {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      objects.set(keyOf({ accountId, mediaId }), { bytes, mimeType });
    },
    get: async ({ accountId, mediaId }) => objects.get(keyOf({ accountId, mediaId })) ?? null,
    signedLink: async ({ ttlMs }) => `exp=${input.clock.now() + ttlMs}&sig=${FAKE_SIGNATURE}`,
    delete: async ({ accountId, mediaIds }) => {
      mediaIds.forEach((mediaId) => objects.delete(keyOf({ accountId, mediaId })));
    },
  };
}

function createCountingIds(): IdGenerator {
  const counters: Record<IdPrefix, number> = { [IdPrefix.Message]: 0, [IdPrefix.Question]: 0, [IdPrefix.Media]: 0 };
  return {
    next: ({ prefix }) => {
      counters[prefix] += 1;
      return `${prefix}_${counters[prefix]}`;
    },
  };
}

export function createInMemoryDependencies(input: InMemoryOptions = {}): InMemoryEnvironment {
  const { accountId = DEFAULT_ACCOUNT_ID, startAt = DEFAULT_START_AT } = input;
  const clock = createFakeClock({ startAt });
  const repository = createInMemoryRepository();
  const sender = createRecordingSender();
  const waker = createRecordingWaker();
  const mediaStore = createInMemoryMediaStore({ accountId, clock });
  const dependencies: CoreDependencies = {
    accountId,
    repository,
    sender,
    mediaStore,
    waker,
    clock,
    ids: createCountingIds(),
    waiters: createReplyWaiters({ clock }),
  };
  return { dependencies, clock, repository, sender, waker, mediaStore };
}
