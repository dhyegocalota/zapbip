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
import {
  CONNECTOR_INBOX_LIMIT,
  CONNECTOR_PING_TEXT,
  CONNECTOR_PONG_TEXT,
  ChannelErrorKind,
  ConnectorFrameType,
  REVOKED_CLOSE_CODE,
  WakeMode,
  WakeOutcome,
  WakeRung,
  type OwnerLocale,
} from '@zapbip/types';
import { createFakeWhatsAppSender, type FakeWhatsAppSender } from '../adapters/fake/fake-whatsapp-sender';
import { createIdGenerator } from '../adapters/platform/ids';
import { loadDurableClock, type DurableClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { createSqliteInboxRepository } from '../adapters/sqlite/sqlite-inbox-repository';
import { createDispatchingAgentWaker } from '../adapters/wake/dispatching-agent-waker';
import { createFetchWakeTransport } from '../adapters/wake/fetch-wake-transport';
import { createLocalConnectorWaker } from '../adapters/wake/local-connector-waker';
import { createNoneWaker } from '../adapters/wake/none-waker';
import { createWebhookAgentWaker } from '../adapters/wake/webhook-agent-waker';
import type { AccountInboxRpc, AgentRequest, CallOutcome } from '../contract/account-inbox-rpc';
import type { DueTimeProvider } from '../contract/due-time-provider';
import type { Bindings } from '../contract/env';
import { LogEvent, type LogFields } from '../contract/log';
import { logEvent } from '../log';
import { nextAlarmAt } from './alarm-time';
import { HttpStatus } from '../routes/http-status';
import {
  acceptConnectorSocket,
  connectorAgentOf,
  hasLiveConnectorSocket,
  parseDoneFrame,
  remainingSocketCount,
  sendFrameToAgent,
  sendMessagesToAgent,
} from './connector-sockets';
import {
  ALARM_MIN_DELAY_MS,
  AlarmErrorCode,
  CONNECTOR_AGENT_PARAMETER,
  NORMAL_CLOSE_CODE,
  OWNER_LOCALE_STORAGE_KEY,
  UNREPLYABLE_CLOSE_CODES,
} from './constants';
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
      accountId,
      storage: this.ctx.storage,
      clock: this.clock,
      transport: this.createWakeTransport(),
    });
    const inboxOnlyDependencies: CoreDependencies = {
      accountId,
      repository: createSqliteInboxRepository({ storage: this.ctx.storage, clock: this.clock }),
      sender: this.sender,
      mediaStore,
      waker: createNoneWaker(),
      clock: this.clock,
      ids: createIdGenerator(),
      waiters: inbox.createReplyWaiters({ clock: this.clock }),
    };
    this.dependencies = {
      ...inboxOnlyDependencies,
      waker: createDispatchingAgentWaker({
        wakers: {
          [WakeRung.Inbox]: createNoneWaker(),
          [WakeRung.Local]: createLocalConnectorWaker({
            context: this.ctx,
            repository: inboxOnlyDependencies.repository,
            restoreAndNotify: (request) => this.restoreAndNotify(request),
          }),
          [WakeRung.Webhook]: createWebhookAgentWaker({ dependencies: inboxOnlyDependencies, wake: this.wake }),
        },
        repository: this.wake.repository,
      }),
    };
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(CONNECTOR_PING_TEXT, CONNECTOR_PONG_TEXT));
    this.dueTimeProviders.push(this.createExpiryProvider(), this.createRoutingListProvider(), this.createWakeProvider());
    await this.armAlarm();
  }

  private async restoreAndNotify(request: Parameters<inbox.AgentWaker['notify']>[0]): Promise<WakeOutcome> {
    const { agent } = request;
    const restore = await this.wake.repository.findLocalRestore({ agent });
    if (restore === null) return WakeOutcome.Unreached;
    await inbox.detachLocalConnector({ dependencies: this.dependencies, wake: this.wake, agent, remainingSockets: 0 });
    return this.dependencies.waker.notify(request);
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

  private createRoutingListProvider(): DueTimeProvider {
    return {
      nextDueAt: () => inbox.findRoutingListDueAt({ dependencies: this.dependencies }),
      runDue: () => inbox.expireRoutingList({ dependencies: this.dependencies }),
    };
  }

  private createWakeProvider(): DueTimeProvider {
    return {
      nextDueAt: () => this.wake.repository.findNextDueAt(),
      runDue: () => this.runDueWakes(),
    };
  }

  protected createWakeTransport(): WakeTransport {
    return createFetchWakeTransport();
  }

  protected async runDueWakes(): Promise<void> {
    const storedOwnerLocale = await this.ctx.storage.get<OwnerLocale>(OWNER_LOCALE_STORAGE_KEY);
    await inbox.runDueWakes({
      dependencies: this.dependencies,
      wake: this.wake,
      ownerLocale: storedOwnerLocale === undefined ? null : storedOwnerLocale,
      publicHost: new URL(this.env.PUBLIC_ORIGIN).hostname,
    });
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
    const armedAt = await this.ctx.storage.getAlarm();
    const dueAt = this.clock.toRealTime({ clockTime: earliestDueAt });
    return this.ctx.storage.setAlarm(nextAlarmAt({ dueAt, armedAt, now: Date.now(), minDelayMs: ALARM_MIN_DELAY_MS }));
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
    return this.outcome({ run: () => inbox.checkInbox({ ...input, dependencies: this.dependencies }) });
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

  claimUpload(input: { mediaId: string }): Promise<CallOutcome<inbox.UploadClaim>> {
    return this.outcome({ run: () => inbox.claimUpload({ ...input, dependencies: this.dependencies }) });
  }

  releaseUpload(input: { mediaId: string; claimedAt: number }): Promise<CallOutcome<void>> {
    return this.outcome({ run: () => inbox.releaseUpload({ ...input, dependencies: this.dependencies }) });
  }

  completeUpload(input: { mediaId: string; claimedAt: number }): Promise<CallOutcome<StoredMedia>> {
    return this.outcome({ run: () => inbox.completeUpload({ ...input, dependencies: this.dependencies }) });
  }

  setWake(input: Parameters<AccountInboxRpc['setWake']>[0]): Promise<CallOutcome<inbox.SetWakeResult>> {
    return this.outcome({
      run: async () => {
        const { agent } = input.connection;
        await inbox.touchAgent({ dependencies: this.dependencies, agent });
        const result = await inbox.setWake({
          ...input,
          dependencies: this.dependencies,
          wake: this.wake,
          publicHost: new URL(this.env.PUBLIC_ORIGIN).hostname,
        });
        const isLocalWithoutConnector = result.wakeMode === WakeMode.Local && !hasLiveConnectorSocket({ context: this.ctx, agent });
        if (isLocalWithoutConnector) return { ...result, effectiveRung: WakeRung.Inbox };
        return result;
      },
    });
  }

  async fetch(request: Request): Promise<Response> {
    const agent = new URL(request.url).searchParams.get(CONNECTOR_AGENT_PARAMETER);
    if (agent === null) return new Response(null, { status: HttpStatus.BadRequest });
    await inbox.touchAgent({ dependencies: this.dependencies, agent });
    const attached = await inbox.attachLocalConnector({
      dependencies: this.dependencies,
      wake: this.wake,
      agent,
      limit: CONNECTOR_INBOX_LIMIT,
    });
    const client = acceptConnectorSocket({ context: this.ctx, agent });
    const hello = { type: ConnectorFrameType.Hello, agent, previousWakeMode: attached.previousWakeMode } as const;
    sendFrameToAgent({ context: this.ctx, agent, frame: hello });
    sendMessagesToAgent({ context: this.ctx, agent, messages: attached.unread });
    return new Response(null, { status: HttpStatus.SwitchingProtocols, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const agent = connectorAgentOf({ context: this.ctx, socket });
    const parsed = parseDoneFrame({ data });
    if (!parsed.ok) return this.log({ event: LogEvent.FrameRejected, agent, errorCode: parsed.reason });
    await inbox.acknowledgeDelivery({ dependencies: this.dependencies, agent, messageId: parsed.frame.messageId });
    const remaining = await this.dependencies.repository.listUnread({ agent, limit: CONNECTOR_INBOX_LIMIT });
    sendMessagesToAgent({ context: this.ctx, agent, messages: remaining });
  }

  private async detachSocket(socket: WebSocket): Promise<void> {
    const agent = connectorAgentOf({ context: this.ctx, socket });
    const remainingSockets = remainingSocketCount({ context: this.ctx, agent, closing: socket });
    await inbox.detachLocalConnector({ dependencies: this.dependencies, wake: this.wake, agent, remainingSockets });
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    await this.detachSocket(socket);
    const replyCode = UNREPLYABLE_CLOSE_CODES.includes(code) ? NORMAL_CLOSE_CODE : code;
    if (socket.readyState !== WebSocket.CLOSED) socket.close(replyCode, reason);
  }

  async closeAgentSockets(input: Parameters<AccountInboxRpc['closeAgentSockets']>[0]): Promise<void> {
    this.ctx.getWebSockets(input.agent).forEach((socket) => socket.close(REVOKED_CLOSE_CODE));
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    await this.detachSocket(socket);
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
