import { DurableObject } from 'cloudflare:workers';
import * as inbox from '@zapbip/core';
import type {
  AccountDependencies,
  ConnectionIdentity,
  AskInput,
  AskResult,
  CheckInboxInput,
  CheckInboxResult,
  CoreDependencies,
  CreateUploadInput,
  CreateUploadResult,
  GetMessagesInput,
  GetMessagesResult,
  MediaStore,
  MessageSender,
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
  InboxErrorCode,
  REVOKED_CLOSE_CODE,
  WakeMode,
  WakeOutcome,
  WakeRung,
  type OwnerLocale,
} from '@zapbip/types';
import { D1AccountDirectory } from '../adapters/d1/d1-account-directory';
import { D1ChannelRestrictions } from '../adapters/d1/d1-channel-restrictions';
import { D1ConnectionDirectory } from '../adapters/d1/d1-connection-directory';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { findOwnerByAccountId } from '../adapters/d1/d1-owner-directory';
import { createConnectionSecrets } from '../adapters/platform/connection-secrets';
import { createInstallCodeVault } from '../adapters/platform/install-code-vault';
import { createIdGenerator } from '../adapters/platform/ids';
import { loadDurableClock, type DurableClock } from '../adapters/platform/clock';
import { D1UsageRepository } from '../adapters/d1/d1-usage-repository';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { createSqliteInboxRepository } from '../adapters/sqlite/sqlite-inbox-repository';
import { createDispatchingAgentWaker } from '../adapters/wake/dispatching-agent-waker';
import { createFetchWakeTransport } from '../adapters/wake/fetch-wake-transport';
import { createInboxAgentWaker } from '../adapters/wake/inbox-agent-waker';
import { createLocalConnectorWaker } from '../adapters/wake/local-connector-waker';
import { createNoneWaker } from '../adapters/wake/none-waker';
import { createScheduledAgentWaker } from '../adapters/wake/scheduled-agent-waker';
import { createStandbyAgentWaker } from '../adapters/wake/standby-agent-waker';
import { createWebhookAgentWaker } from '../adapters/wake/webhook-agent-waker';
import { createCloudApiMessageSender } from '../adapters/whatsapp/cloud-api-message-sender';
import { createGraphClient } from '../adapters/whatsapp/graph-client';
import { readWhatsAppEnvironment } from '../adapters/whatsapp/read-whatsapp-env';
import type { AccountInboxRpc, AgentRequest, CallOutcome } from '../contract/account-inbox-rpc';
import type { AccountOwnerRpc } from '../contract/account-owner-rpc';
import type { DueTimeProvider } from '../contract/due-time-provider';
import type { Bindings } from '../contract/env';
import { LogEvent, type LogFields } from '../contract/log';
import { logEvent } from '../log';
import { AccountTombstoned } from './account-tombstoned';
import { logFieldsOfAccountResult } from './account-log';
import { isCurrentKeyDigest, recordKeyDigest } from './agent-key-digest';
import { isAgentRevoked, reviveAgentName, revokeAgentState } from './agent-revocation';
import { nextAlarmAt } from './alarm-time';
import { HttpStatus } from '../routes/http-status';
import { isAccountActive, isConnectionAdmitted } from './connection-admission';
import {
  acceptConnectorSocket,
  connectorAgentOf,
  hasLiveConnectorSocket,
  parseDoneFrame,
  rejectConnectorSocket,
  remainingSocketCount,
  sendFrameToAgent,
  sendMessagesToAgent,
} from './connector-sockets';
import {
  ALARM_MIN_DELAY_MS,
  AlarmErrorCode,
  CONNECTION_NOT_ACTIVE_MESSAGE,
  CONNECTOR_AGENT_PARAMETER,
  CONNECTOR_DIGEST_PARAMETER,
  NORMAL_CLOSE_CODE,
  OWNER_LOCALE_STORAGE_KEY,
  TOMBSTONE_STORAGE_KEY,
  UNREPLYABLE_CLOSE_CODES,
} from './constants';
import { createSqliteDeletionRequests } from './deletion-requests';
import { createSqliteFirstMessageClaim } from './first-message-claim';
import { redactInstallCodes } from './install-code-redaction';
import { ACCOUNT_INBOX_MIGRATIONS } from './migrations';
import { runMigrations } from './run-migrations';
import { recordUsage } from './usage-ledger';
import { gigabyteSecondsForDuration, utcDay } from './usage-meter';
import { createUsageProvider } from './usage-provider';
import { createWakeDependencies } from './wake-dependencies';

type ReceiveAccountMessageRequest = Parameters<AccountOwnerRpc['receiveAccountMessage']>[0];

function failureLog(input: { error: inbox.InboxError }): LogFields {
  const { error } = input;
  if (error instanceof inbox.NoticeFailedError) return { event: LogEvent.OwnerNoticeFailed, kind: error.templateKind };
  const event = error.code === ChannelErrorKind.DeliveryFailed ? LogEvent.SendFailed : LogEvent.ToolError;
  return { event, errorCode: error.code };
}

type ReceiveOwnerMessageRequest = Parameters<AccountInboxRpc['receiveOwnerMessage']>[0];

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc, AccountOwnerRpc {
  protected sender!: MessageSender;
  protected clock!: DurableClock;
  protected wake!: WakeDependencies;
  protected readonly dueTimeProviders: DueTimeProvider[] = [];
  protected accountId!: string;
  private dependencies!: CoreDependencies;
  private accountDependencies!: AccountDependencies;
  private isTombstoned = false;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => this.initialize());
  }

  private async initialize(): Promise<void> {
    const { name: accountId } = this.ctx.id;
    if (accountId === undefined) throw new Error('AccountInbox id has no name');
    this.isTombstoned = (await this.ctx.storage.get(TOMBSTONE_STORAGE_KEY)) !== undefined;
    if (this.isTombstoned) return;
    runMigrations({ storage: this.ctx.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    this.accountId = accountId;
    this.clock = await loadDurableClock({ storage: this.ctx.storage, onAdvanced: () => this.armAlarm() });
    const mediaStore = mediaStoreOf({ bindings: this.env, clock: this.clock });
    this.sender = this.createSender({ mediaStore });
    this.wake = createWakeDependencies({
      env: this.env,
      accountId,
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
        [WakeRung.Local]: createLocalConnectorWaker({
          context: this.ctx,
          repository: this.dependencies.repository,
          restoreAndNotify: (request) => this.restoreAndNotify(request),
        }),
        [WakeRung.Webhook]: createWebhookAgentWaker(wakerContext),
        [WakeRung.Scheduled]: createScheduledAgentWaker(wakerContext),
        [WakeRung.Standby]: createStandbyAgentWaker(wakerContext),
      },
      repository: this.wake.repository,
      clock: this.clock,
    });
    this.accountDependencies = {
      ...this.dependencies,
      accounts: new D1AccountDirectory({ database: this.env.CONNECTIONS }),
      connections: new D1ConnectionRegistry({ database: this.env.CONNECTIONS }),
      connectionSecrets: createConnectionSecrets(),
      installCodeVault: createInstallCodeVault(),
      revocations: {
        recordRevocation: ({ agent }) => this.recordRevocation({ agent }),
        recordCreation: ({ agent, secretDigest }) => this.recordCreation({ agent, secretDigest }),
        recordRotation: ({ agent, secretDigest }) => this.recordRotation({ agent, secretDigest }),
        cancelWaiters: ({ agent }) => this.cancelWaiters({ agent }),
      },
      firstMessage: createSqliteFirstMessageClaim({ storage: this.ctx.storage }),
      deletionRequests: createSqliteDeletionRequests({ storage: this.ctx.storage }),
      installLinkRedaction: { redact: async ({ messageIds }) => redactInstallCodes({ storage: this.ctx.storage, messageIds }) },
    };
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(CONNECTOR_PING_TEXT, CONNECTOR_PONG_TEXT));
    this.dueTimeProviders.push(
      this.createExpiryProvider(),
      this.createRoutingListProvider(),
      this.createWakeProvider(),
      this.createPollerProvider(),
      this.createNoticeRetryProvider(),
      this.createUsageProvider(),
    );
    await this.armAlarm();
  }

  private async restoreAndNotify(request: Parameters<inbox.AgentWaker['notify']>[0]): Promise<WakeOutcome> {
    const { agent } = request;
    const restore = await this.wake.repository.findLocalRestore({ agent });
    if (restore === null) return WakeOutcome.Unreached;
    await inbox.detachLocalConnector({ dependencies: this.dependencies, wake: this.wake, agent, remainingSockets: 0 });
    return this.dependencies.waker.notify(request);
  }

  protected createSender(input: { mediaStore: MediaStore }): MessageSender {
    const whatsapp = readWhatsAppEnvironment({ env: this.env });
    const database = this.env.CONNECTIONS;
    return createCloudApiMessageSender({
      accountId: this.accountId,
      graph: createGraphClient({
        baseUrl: whatsapp.graphBaseUrl,
        accessToken: whatsapp.accessToken,
        developmentMediaOrigin: null,
        fetcher: fetch,
      }),
      findOwnerByAccountId: ({ accountId }) => findOwnerByAccountId({ database, accountId }),
      messageIndex: new D1MessageIndex({ database }),
      restrictions: new D1ChannelRestrictions({ database, phoneNumberId: whatsapp.phoneNumberId }),
      mediaStore: input.mediaStore,
      publicOrigin: this.env.PUBLIC_ORIGIN,
      phoneNumberId: whatsapp.phoneNumberId,
      clock: this.clock,
    });
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

  private createUsageProvider(): DueTimeProvider {
    return createUsageProvider({
      storage: this.ctx.storage,
      repository: new D1UsageRepository({ database: this.env.CONNECTIONS }),
      accountId: this.accountId,
    });
  }

  private recordUsage(input: { startedAt: number }): void {
    const now = this.clock.now();
    recordUsage({
      storage: this.ctx.storage,
      day: utcDay({ now }),
      gigabyteSeconds: gigabyteSecondsForDuration({ durationMs: Date.now() - input.startedAt }),
      now,
    });
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
    const storedOwnerLocale = await this.ctx.storage.get<OwnerLocale>(OWNER_LOCALE_STORAGE_KEY);
    await inbox.runDueWakes({
      dependencies: this.dependencies,
      wake: this.wake,
      ownerLocale: storedOwnerLocale === undefined ? null : storedOwnerLocale,
      publicHost: new URL(this.env.PUBLIC_ORIGIN).hostname,
    });
  }

  private async rememberOwnerLocale(input: { ownerLocale: OwnerLocale }): Promise<void> {
    await this.ctx.storage.put(OWNER_LOCALE_STORAGE_KEY, input.ownerLocale);
  }

  private createNoticeRetryProvider(): DueTimeProvider {
    return {
      nextDueAt: () => inbox.findNoticeRetryDueAt({ dependencies: this.dependencies }),
      runDue: async () => {
        try {
          await inbox.retryNotice({ dependencies: this.dependencies });
        } catch (error) {
          if (!(error instanceof inbox.NoticeFailedError)) throw error;
          this.log(failureLog({ error }));
        }
      },
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

  private assertLive(): void {
    if (this.isTombstoned) throw new AccountTombstoned();
  }

  protected async armAlarm(): Promise<void> {
    if (this.isTombstoned) return;
    const dueTimes = await Promise.all(this.dueTimeProviders.map((provider) => this.findNextDueAt({ provider })));
    const pendingDueTimes = dueTimes.filter((dueAt): dueAt is number => dueAt !== null);
    if (pendingDueTimes.length === 0) return this.ctx.storage.deleteAlarm();
    const earliestDueAt = Math.min(...pendingDueTimes);
    const armedAt = await this.ctx.storage.getAlarm();
    const dueAt = this.clock.toRealTime({ clockTime: earliestDueAt });
    return this.ctx.storage.setAlarm(nextAlarmAt({ dueAt, armedAt, now: Date.now(), minDelayMs: ALARM_MIN_DELAY_MS }));
  }

  async alarm(): Promise<void> {
    if (this.isTombstoned) return;
    const isActive = await isAccountActive({ database: this.env.CONNECTIONS, accountId: this.accountId });
    if (!isActive) return this.ctx.storage.deleteAlarm();
    const now = this.clock.now();
    await this.dueTimeProviders.reduce((previous, provider) => previous.then(() => this.runProvider({ provider, now })), Promise.resolve());
    await this.armAlarm();
  }

  private async outcome<Value>(input: {
    run: () => Promise<Value>;
    describe?: (value: Value) => LogFields | LogFields[];
    connection?: ConnectionIdentity;
  }): Promise<CallOutcome<Value>> {
    const startedAt = Date.now();
    this.assertLive();
    if (input.connection !== undefined) {
      const isAdmittedByDirectory = await isConnectionAdmitted({ database: this.env.CONNECTIONS, connection: input.connection });
      const isRevokedHere = isAgentRevoked({ storage: this.ctx.storage, agent: input.connection.agent });
      const isAdmitted = isAdmittedByDirectory && !isRevokedHere;
      if (!isAdmitted) {
        this.dependencies.waiters.cancelAgent({ agent: input.connection.agent });
        return { ok: false, errorCode: InboxErrorCode.NotFound, message: CONNECTION_NOT_ACTIVE_MESSAGE };
      }
    }
    try {
      const value = await input.run();
      if (input.describe !== undefined) [input.describe(value)].flat().forEach((fields) => this.log(fields));
      return { ok: true, value };
    } catch (error) {
      if (!(error instanceof inbox.InboxError)) throw error;
      this.log(failureLog({ error }));
      return { ok: false, errorCode: error.code, message: error.message };
    } finally {
      this.recordUsage({ startedAt });
      await this.armAlarm();
    }
  }

  private sendOutcome(input: { run: () => Promise<SendResult>; connection: ConnectionIdentity }): Promise<CallOutcome<SendResult>> {
    const { connection } = input;
    return this.outcome({
      connection,
      run: input.run,
      describe: (value) => ({ event: LogEvent.Send, agent: connection.agent, messageId: value.messageId }),
    });
  }

  sendText(input: AgentRequest<SendTextInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.sendText({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  sendMedia(input: AgentRequest<SendMediaInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.sendMedia({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  sendLocation(input: AgentRequest<SendLocationInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({
      run: () => inbox.sendLocation({ ...input, dependencies: this.dependencies }),
      connection: input.connection,
    });
  }

  sendContacts(input: AgentRequest<SendContactsInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({
      run: () => inbox.sendContacts({ ...input, dependencies: this.dependencies }),
      connection: input.connection,
    });
  }

  react(input: AgentRequest<ReactInput>): Promise<CallOutcome<SendResult>> {
    return this.sendOutcome({ run: () => inbox.react({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  ask(input: AgentRequest<AskInput>): Promise<CallOutcome<AskResult>> {
    return this.outcome({ run: () => inbox.ask({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  waitForReply(input: AgentRequest<WaitForReplyInput>): Promise<CallOutcome<WaitForReplyResult>> {
    return this.outcome({ run: () => inbox.waitForReply({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  getMessages(input: AgentRequest<GetMessagesInput>): Promise<CallOutcome<GetMessagesResult>> {
    return this.outcome({ run: () => inbox.getMessages({ ...input, dependencies: this.dependencies }), connection: input.connection });
  }

  checkInbox(input: AgentRequest<CheckInboxInput>): Promise<CallOutcome<CheckInboxResult>> {
    return this.outcome({
      run: () => inbox.pollInbox({ ...input, dependencies: this.dependencies, wake: this.wake }),
      connection: input.connection,
    });
  }

  createUpload(input: AgentRequest<CreateUploadInput>): Promise<CallOutcome<CreateUploadResult>> {
    return this.outcome({
      connection: input.connection,
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

  receiveAccountMessage(input: ReceiveAccountMessageRequest): Promise<CallOutcome<inbox.ReceiveAccountMessageResult>> {
    return this.outcome({
      run: async () => {
        await this.rememberOwnerLocale({ ownerLocale: input.account.locale });
        return inbox.receiveAccountMessage({ ...input, dependencies: this.accountDependencies });
      },
      describe: (value) => [
        { event: value.duplicate ? LogEvent.OwnerMessageDuplicate : LogEvent.OwnerMessage },
        ...logFieldsOfAccountResult({ result: value, accountId: input.account.accountId, locale: input.account.locale }),
      ],
    });
  }

  async recordRevocation(input: { agent: string }): Promise<void> {
    this.assertLive();
    revokeAgentState({ storage: this.ctx.storage, agent: input.agent, revokedAt: this.clock.now() });
    this.dependencies.waiters.cancelAgent(input);
    await this.closeAgentSockets(input);
  }

  async recordCreation(input: { agent: string; secretDigest: string }): Promise<void> {
    this.assertLive();
    reviveAgentName({ storage: this.ctx.storage, agent: input.agent, revivedAt: this.clock.now() });
    recordKeyDigest({ storage: this.ctx.storage, ...input });
    await this.closeAgentSockets(input);
  }

  async recordRotation(input: { agent: string; secretDigest: string }): Promise<void> {
    this.assertLive();
    recordKeyDigest({ storage: this.ctx.storage, ...input });
    await this.closeAgentSockets(input);
  }

  async cancelWaiters(input: { agent: string }): Promise<void> {
    this.assertLive();
    this.dependencies.waiters.cancelAgent(input);
  }

  async purge(): Promise<void> {
    const wasLive = !this.isTombstoned;
    this.isTombstoned = true;
    if (wasLive) this.dependencies.waiters.cancelAll();
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put(TOMBSTONE_STORAGE_KEY, true);
    this.ctx.getWebSockets().forEach((socket) => socket.close(REVOKED_CLOSE_CODE));
  }

  setWake(input: Parameters<AccountInboxRpc['setWake']>[0]): Promise<CallOutcome<inbox.SetWakeResult>> {
    return this.outcome({
      connection: input.connection,
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

  private async isConnectorKeyLive(input: { agent: string; secretDigest: string }): Promise<boolean> {
    const { agent, secretDigest } = input;
    const resolved = await new D1ConnectionDirectory({ database: this.env.CONNECTIONS }).resolveSecretDigest({ secretDigest });
    const isKeyOfThisAgent = resolved !== null && resolved.accountId === this.accountId && resolved.agent === agent;
    return isKeyOfThisAgent && !isAgentRevoked({ storage: this.ctx.storage, agent });
  }

  async fetch(request: Request): Promise<Response> {
    this.assertLive();
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get(CONNECTOR_AGENT_PARAMETER);
    const secretDigest = searchParams.get(CONNECTOR_DIGEST_PARAMETER);
    if (agent === null || secretDigest === null) return new Response(null, { status: HttpStatus.BadRequest });
    const isKeyLive = await this.isConnectorKeyLive({ agent, secretDigest });
    this.assertLive();
    const isCurrentKey = isCurrentKeyDigest({ storage: this.ctx.storage, agent, secretDigest });
    const isAdmitted = isKeyLive && isCurrentKey;
    if (!isAdmitted) return new Response(null, { status: HttpStatus.SwitchingProtocols, webSocket: rejectConnectorSocket() });
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
    if (this.dependencies.waiters.hasLiveWaiter({ agent, questionId: null })) return;
    const remaining = await this.dependencies.repository.listUnread({ agent, limit: CONNECTOR_INBOX_LIMIT });
    sendMessagesToAgent({ context: this.ctx, agent, messages: remaining });
  }

  private async detachSocket(socket: WebSocket): Promise<void> {
    if (this.isTombstoned) return;
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
        await this.rememberOwnerLocale({ ownerLocale: input.ownerLocale });
        return inbox.receiveOwnerMessage({ ...input, dependencies: this.dependencies });
      },
      describe: (value) => ({ event: value.duplicate ? LogEvent.OwnerMessageDuplicate : LogEvent.OwnerMessage }),
    });
  }

  receiveChannelMessage(input: AgentRequest<inbox.ReceiveChannelInput>): Promise<CallOutcome<inbox.ReceiveResult>> {
    return this.outcome({
      run: async () => {
        await this.rememberOwnerLocale({ ownerLocale: input.ownerLocale });
        return inbox.receiveChannelMessage({ ...input, dependencies: this.dependencies });
      },
      describe: (value) => ({ event: value.duplicate ? LogEvent.OwnerMessageDuplicate : LogEvent.OwnerMessage }),
    });
  }

  hasChannelReceipt(input: { channelMessageId: string }): Promise<CallOutcome<boolean>> {
    return this.outcome({ run: () => inbox.hasChannelReceipt({ ...input, dependencies: this.dependencies }) });
  }

  applyChannelStatus(input: AgentRequest<inbox.ApplyStatusInput>): Promise<CallOutcome<inbox.ApplyStatusResult>> {
    return this.outcome({ run: () => inbox.applyStatus({ ...input, dependencies: this.dependencies }) });
  }
}
