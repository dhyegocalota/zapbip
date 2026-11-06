import type { AgentWakeReason, IdPrefix, LinkPurpose, OwnerLocale, TemplateKind, WakeOutcome, DeliveryState } from '@zapbip/types';
import type { AgentName, ConnectionIdentity } from './connection';
import type { Message } from './message';
import type { Question, QuestionAnswer } from './question';
import type { AgentRecord, OwnerWindow, RoutingList, StoredMedia } from './inbox-records';

export type MediaBody = ReadableStream<Uint8Array>;

export type MediaObject = {
  bytes: Uint8Array;
  mimeType: string;
};

export interface Clock {
  now(): number;
  schedule(input: { delayMs: number; run: () => void }): { cancel: () => void };
}

export interface IdGenerator {
  next(input: { prefix: IdPrefix }): string;
}

export interface InboxRepository {
  registerAgent(input: { agent: AgentName; seenAt: number }): Promise<void>;
  listAgents(): Promise<AgentRecord[]>;
  insertMessage(input: { message: Message }): Promise<void>;
  updateDelivery(input: { messageId: string; delivery: DeliveryState }): Promise<void>;
  findMessage(input: { messageId: string }): Promise<Message | null>;
  listAgentHistory(input: { agent: AgentName; limit: number }): Promise<Message[]>;
  listUnread(input: { agent: AgentName; limit: number }): Promise<Message[]>;
  countUnread(input: { agent: AgentName }): Promise<number>;
  markRead(input: { messageIds: string[] }): Promise<void>;
  listHeld(): Promise<Message[]>;
  assignAgent(input: { messageIds: string[]; agent: AgentName }): Promise<void>;
  listQueued(): Promise<Message[]>;
  findLastAgentWrite(input: { since: number }): Promise<AgentName | null>;
  insertQuestion(input: { question: Question }): Promise<void>;
  findQuestion(input: { questionId: string }): Promise<Question | null>;
  findRecentQuestion(input: { agent: AgentName; normalizedKey: string; askedAfter: number }): Promise<Question | null>;
  listOpenQuestions(): Promise<Question[]>;
  saveAnswer(input: { questionId: string; answer: QuestionAnswer }): Promise<void>;
  recordChannelReceipt(input: { wamid: string; receivedAt: number }): Promise<boolean>;
  linkChannelReceipt(input: { wamid: string; messageId: string }): Promise<void>;
  findChannelReceiptMessageId(input: { wamid: string }): Promise<string | null>;
  deleteExpiredReceipts(input: { receivedBefore: number }): Promise<void>;
  deleteQuestionsAskedBefore(input: { askedBefore: number }): Promise<void>;
  findWindow(): Promise<OwnerWindow>;
  saveWindow(input: { window: OwnerWindow }): Promise<void>;
  claimNotice(): Promise<boolean>;
  findRoutingList(): Promise<RoutingList | null>;
  saveRoutingList(input: { routingList: RoutingList }): Promise<void>;
  clearRoutingList(): Promise<void>;
  insertMedia(input: { media: StoredMedia }): Promise<void>;
  findMedia(input: { mediaId: string }): Promise<StoredMedia | null>;
  claimUpload(input: { mediaId: string }): Promise<boolean>;
  releaseUpload(input: { mediaId: string }): Promise<void>;
  markMediaReceived(input: { mediaId: string; receivedAt: number; retentionUntil: number }): Promise<void>;
  listExpiredMediaIds(input: { now: number }): Promise<string[]>;
  deleteMedia(input: { mediaIds: string[] }): Promise<void>;
  findNextExpiry(): Promise<number | null>;
}

export interface MessageSender {
  session(input: { message: Message }): Promise<{ channelMessageId: string }>;
  template(input: { kind: TemplateKind; locale: OwnerLocale; parameters: string[] }): Promise<{ channelMessageId: string }>;
}

export interface MediaStore {
  put(input: { accountId: string; mediaId: string; body: MediaBody; sizeBytes: number; mimeType: string }): Promise<void>;
  get(input: { accountId: string; mediaId: string }): Promise<MediaObject | null>;
  signedLink(input: { accountId: string; mediaId: string; purpose: LinkPurpose; ttlMs: number }): Promise<string>;
  delete(input: { accountId: string; mediaIds: string[] }): Promise<void>;
}

export interface AgentWaker {
  notify(input: { agent: AgentName; reason: AgentWakeReason }): Promise<WakeOutcome>;
  hasFailedWake(input: { agent: AgentName }): Promise<boolean>;
  pushesEveryMessage(input: { agent: AgentName }): Promise<boolean>;
}

export interface ConnectionDirectory {
  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null>;
}

export interface ReplyWaiters {
  awaitQuestionAnswer(input: { agent: AgentName; questionId: string; timeoutMs: number }): Promise<void>;
  awaitAgentMessage(input: { agent: AgentName; timeoutMs: number }): Promise<void>;
  resolveQuestionAnswer(input: { questionId: string }): void;
  resolveAgentMessage(input: { agent: AgentName }): void;
  hasLiveWaiter(input: { agent: AgentName; questionId: string | null }): boolean;
}

export type CoreDependencies = {
  accountId: string;
  repository: InboxRepository;
  sender: MessageSender;
  mediaStore: MediaStore;
  waker: AgentWaker;
  clock: Clock;
  ids: IdGenerator;
  waiters: ReplyWaiters;
};
