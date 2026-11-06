import type { AgentWakeReason, OwnerLocale, TemplateKind, WakeOutcome } from '@zapbip/types';
import type { AgentName } from '../connection';
import type { Message } from '../message';
import type { AgentWaker, CoreDependencies, InboxRepository, MediaStore, MessageSender } from '../ports';
import type { FakeClock } from './fake-clock';

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

export type InMemoryMediaStore = MediaStore & {
  hasObject(input: { mediaId: string }): boolean;
};

export type InMemoryOptions = { accountId?: string; startAt?: number };

export type InMemoryEnvironment = {
  dependencies: CoreDependencies;
  clock: FakeClock;
  repository: InboxRepository;
  sender: RecordingSender;
  waker: RecordingWaker;
  mediaStore: InMemoryMediaStore;
};

export function createInMemoryDependencies(input: InMemoryOptions = {}): InMemoryEnvironment {
  void input;
  throw new Error('createInMemoryDependencies is not implemented');
}
