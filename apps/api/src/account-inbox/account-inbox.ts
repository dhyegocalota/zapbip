import { DurableObject } from 'cloudflare:workers';
import * as inbox from '@zapbip/core';
import type {
  AskInput,
  AskResult,
  CheckInboxInput,
  CheckInboxResult,
  CoreDependencies,
  CreateUploadInput,
  CreateUploadResult,
  GetMessagesInput,
  GetMessagesResult,
  ReactInput,
  SendContactsInput,
  SendLocationInput,
  SendMediaInput,
  SendResult,
  SendTextInput,
  StoredMedia,
  WaitForReplyInput,
  WaitForReplyResult,
  WakeDependencies,
  WakeTransport,
} from '@zapbip/core';
import { ChannelErrorKind, WakeRung, type OwnerLocale } from '@zapbip/types';
import { createFakeWhatsAppSender, type FakeWhatsAppSender } from '../adapters/fake/fake-whatsapp-sender';
import { createIdGenerator } from '../adapters/platform/ids';
import { loadDurableClock, type DurableClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { createSqliteInboxRepository } from '../adapters/sqlite/sqlite-inbox-repository';
import { createDispatchingAgentWaker } from '../adapters/wake/dispatching-agent-waker';
import { createFetchWakeTransport } from '../adapters/wake/fetch-wake-transport';
import { createInboxAgentWaker } from '../adapters/wake/inbox-agent-waker';
import { createNoneWaker } from '../adapters/wake/none-waker';
import { createScheduledAgentWaker } from '../adapters/wake/scheduled-agent-waker';
import { createStandbyAgentWaker } from '../adapters/wake/standby-agent-waker';
import { createWebhookAgentWaker } from '../adapters/wake/webhook-agent-waker';
import type { AccountInboxRpc, AgentRequest, CallOutcome } from '../contract/account-inbox-rpc';
import type { DueTimeProvider } from '../contract/due-time-provider';
import type { Bindings } from '../contract/env';
import { LogEvent, type LogFields } from '../contract/log';
import { logEvent } from '../log';
import { ALARM_MIN_DELAY_MS, AlarmErrorCode, OWNER_LOCALE_STORAGE_KEY } from './constants';
import { ACCOUNT_INBOX_MIGRATIONS } from './migrations';
import { runMigrations } from './run-migrations';
import { createWakeDependencies } from './wake-dependencies';

type ReceiveOwnerMessageRequest = Parameters<AccountInboxRpc['receiveOwnerMessage']>[0];

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc {
  protected sender!: FakeWhatsAppSender;
  protected clock!: DurableClock;
  protected wake!: WakeDependencies;
  protected readonly dueTimeProviders: DueTimeProvider[] = [];
  private accountId!: string;
  private dependencies!: CoreDependencies;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => this.initialize());
  }

  private async initialize(): Promise<void> {
    const { name: accountId } = this.ctx.id;
    if (accountId === undefined) throw new Error('AccountInbox id has no name');
    runMigrations({ storage: this.ctx.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    this.accountId = accountId;
    this.clock = await loadDurableClock({ storage: this.ctx.storage, onAdvanced: () => this.armAlarm() });
    const mediaStore = mediaStoreOf({ bindings: this.env, clock: this.clock });
    this.sender = createFakeWhatsAppSender({
      storage: this.ctx.storage,
      clock: this.clock,
      mediaStore,
      accountId,
      origin: this.env.PUBLIC_ORIGIN,
    });
    this.wake = createWakeDependencies({
      env: this.env,
      storage: this.ctx.storage,
      clock: this.clock,
      transport: this.createWakeTransport(),
    });
    this.dependencies = {
      accountId,
      repository: createSqliteInboxRepository({ storage: this.ctx.storage, clock: this.clock }),
      sender: this.sender,
      mediaStore,
      waker: createNoneWaker(),
      clock: this.clock,
      ids: createIdGenerator(),
      waiters: inbox.createReplyWaiters({ clock: this.clock }),
    };
    const wakerContext = { dependencies: this.dependencies, wake: this.wake };
    this.dependencies.waker = createDispatchingAgentWaker({
      wakers: {
        [WakeRung.Inbox]: createInboxAgentWaker(wakerContext),
        [WakeRung.Webhook]: createWebhookAgentWaker(wakerContext),
        [WakeRung.Scheduled]: createScheduledAgentWaker(wakerContext),
        [WakeRung.Standby]: createStandbyAgentWaker(wakerContext),
      },
      repository: this.wake.repository,
      clock: this.clock,
    });
    this.dueTimeProviders.push(
      this.createExpiryProvider(),
      this.createRoutingListProvider(),
      this.createWakeProvider(),
      this.createPollerProvider(),
    );
    await this.armAlarm();
  }

  private createExpiryProvider(): DueTimeProvider {
    return {
      nextDueAt: () => this.dependencies.repository.findNextExpiry(),
      runDue: async () => {
        await inbox.sweepExpired({ dependencies: this.dependencies });
        this.log({ event: LogEvent.Sweep });
      },
    };
  }

  private createWakeProvider(): DueTimeProvider {
    return {
      nextDueAt: () => this.wake.repository.findNextDueAt(),
      runDue: () => this.runDueWakes(),
    };
  }

  private createPollerProvider(): DueTimeProvider {
    return {
      nextDueAt: () => inbox.nextPollerDeadline({ wake: this.wake }),
      runDue: async () => {
        await inbox.evaluatePollers({ dependencies: this.dependencies, wake: this.wake });
      },
    };
  }

  protected createWakeTransport(): WakeTransport {
    return createFetchWakeTransport();
  }

  protected async runDueWakes(): Promise<void> {
    const storedOwnerLocale = (await this.ctx.storage.get<OwnerLocale>(OWNER_LOCALE_STORAGE_KEY)) as OwnerLocale;
    await inbox.runDueWakes({ dependencies: this.dependencies, wake: this.wake, ownerLocale: storedOwnerLocale });
  }

  private createRoutingListProvider(): DueTimeProvider {
    return {
      nextDueAt: () => inbox.findRoutingListDueAt({ dependencies: this.dependencies }),
      runDue: () => inbox.expireRoutingList({ dependencies: this.dependencies }),
    };
  }

  private log(fields: LogFields): void {
    logEvent({ accountId: this.accountId, ...fields });
  }

  private async runProvider(input: { provider: DueTimeProvider; now: number }): Promise<void> {
    try {
      await input.provider.runDue({ now: input.now });
    } catch {
      this.log({ event: LogEvent.Sweep, errorCode: AlarmErrorCode.ProviderFailed });
    }
  }

  private async findNextDueAt(input: { provider: DueTimeProvider }): Promise<number | null> {
    try {
      return await input.provider.nextDueAt();
    } catch {
      return null;
    }
  }

  protected async armAlarm(): Promise<void> {
    const dueTimes = await Promise.all(this.dueTimeProviders.map((provider) => this.findNextDueAt({ provider })));
    const pendingDueTimes = dueTimes.filter((dueAt): dueAt is number => dueAt !== null);
    if (pendingDueTimes.length === 0) return this.ctx.storage.deleteAlarm();
    const earliestDueAt = Math.min(...pendingDueTimes);
    return this.ctx.storage.setAlarm(Math.max(this.clock.toRealTime({ clockTime: earliestDueAt }), Date.now() + ALARM_MIN_DELAY_MS));
  }

  async alarm(): Promise<void> {
    const now = this.clock.now();
    await this.dueTimeProviders.reduce((previous, provider) => previous.then(() => this.runProvider({ provider, now })), Promise.resolve());
    await this.armAlarm();
  }

  private async outcome<Value>(input: { run: () => Promise<Value>; describe?: (value: Value) => LogFields }): Promise<CallOutcome<Value>> {
    try {
      const value = await input.run();
      if (input.describe !== undefined) this.log(input.describe(value));
      return { ok: true, value };
    } catch (error) {
      if (!(error instanceof inbox.InboxError)) throw error;
      const event = error.code === ChannelErrorKind.DeliveryFailed ? LogEvent.SendFailed : LogEvent.ToolError;
      this.log({ event, errorCode: error.code });
      return { ok: false, errorCode: error.code, message: error.message };
    } finally {
      await this.armAlarm();
    }
  }

  private sendOutcome(input: { run: () => Promise<SendResult>; agent: string }): Promise<CallOutcome<SendResult>> {
    return this.outcome({
      run: input.run,
      describe: (value) => ({ event: LogEvent.Send, agent: input.agent, messageId: value.messageId }),
    });
  }

  sendText(input: AgentRequest<SendTextInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.sendText({ ...input, dependencies: this.dependencies }), agent: input.connection.agent });
  }

  sendMedia(input: AgentRequest<SendMediaInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.sendMedia({ ...input, dependencies: this.dependencies }), agent: input.connection.agent });
  }

  sendLocation(input: AgentRequest<SendLocationInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({
      run: () => inbox.sendLocation({ ...input, dependencies: this.dependencies }),
      agent: input.connection.agent,
    });
  }

  sendContacts(input: AgentRequest<SendContactsInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({
      run: () => inbox.sendContacts({ ...input, dependencies: this.dependencies }),
      agent: input.connection.agent,
    });
  }

  react(input: AgentRequest<ReactInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.react({ ...input, dependencies: this.dependencies }), agent: input.connection.agent });
  }

  ask(input: AgentRequest<AskInput>): Promise<CallOutcome<AskResult>> {
    return this.outcome({ run: () => inbox.ask({ ...input, dependencies: this.dependencies }) });
  }

  waitForReply(input: AgentRequest<WaitForReplyInput>): Promise<CallOutcome<WaitForReplyResult>> {
    return this.outcome({ run: () => inbox.waitForReply({ ...input, dependencies: this.dependencies }) });
  }

  getMessages(input: AgentRequest<GetMessagesInput>): Promise<CallOutcome<GetMessagesResult>> {
    return this.outcome({ run: () => inbox.getMessages({ ...input, dependencies: this.dependencies }) });
  }

  checkInbox(input: AgentRequest<CheckInboxInput>): Promise<CallOutcome<CheckInboxResult>> {
    return this.outcome({ run: () => inbox.pollInbox({ ...input, dependencies: this.dependencies, wake: this.wake }) });
  }

  createUpload(input: AgentRequest<CreateUploadInput>): Promise<CallOutcome<CreateUploadResult>> {
    return this.outcome({
      run: () => inbox.createUpload({ ...input, dependencies: this.dependencies }),
      describe: (value) => ({
        event: LogEvent.Upload,
        agent: input.connection.agent,
        messageId: value.uploadId,
        sizeBytes: input.sizeBytes,
      }),
    });
  }

  describeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>> {
    return this.outcome({ run: () => inbox.describeUpload({ ...input, dependencies: this.dependencies }) });
  }

  claimUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>> {
    return this.outcome({ run: () => inbox.claimUpload({ ...input, dependencies: this.dependencies }) });
  }

  releaseUpload(input: { mediaId: string }): Promise<CallOutcome<void>> {
    return this.outcome({ run: () => inbox.releaseUpload({ ...input, dependencies: this.dependencies }) });
  }

  completeUpload(input: { mediaId: string }): Promise<CallOutcome<StoredMedia>> {
    return this.outcome({ run: () => inbox.completeUpload({ ...input, dependencies: this.dependencies }) });
  }

  setWake(input: Parameters<AccountInboxRpc['setWake']>[0]): Promise<CallOutcome<inbox.SetWakeResult>> {
    return this.outcome({
      run: async () => {
        await inbox.touchAgent({ dependencies: this.dependencies, agent: input.connection.agent });
        return inbox.setWake({
          ...input,
          dependencies: this.dependencies,
          wake: this.wake,
          publicHost: new URL(this.env.PUBLIC_ORIGIN).hostname,
        });
      },
    });
  }

  receiveOwnerMessage(input: ReceiveOwnerMessageRequest): Promise<CallOutcome<inbox.ReceiveResult>> {
    return this.outcome({
      run: async () => {
        await this.ctx.storage.put(OWNER_LOCALE_STORAGE_KEY, input.ownerLocale);
        return inbox.receiveOwnerMessage({ ...input, dependencies: this.dependencies });
      },
      describe: (value) => ({ event: value.duplicate ? LogEvent.OwnerMessageDuplicate : LogEvent.OwnerMessage }),
    });
  }
}
