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
} from '@zapbip/core';
import { ChannelErrorKind, InboxErrorCode } from '@zapbip/types';
import { D1AccountDirectory } from '../adapters/d1/d1-account-directory';
import { D1ChannelRestrictions } from '../adapters/d1/d1-channel-restrictions';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import { D1MessageIndex } from '../adapters/d1/d1-message-index';
import { findOwnerByAccountId } from '../adapters/d1/d1-owner-directory';
import { createConnectionSecrets } from '../adapters/platform/connection-secrets';
import { createInstallCodeVault } from '../adapters/platform/install-code-vault';
import { createIdGenerator } from '../adapters/platform/ids';
import { loadDurableClock, type DurableClock } from '../adapters/platform/clock';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { createSqliteInboxRepository } from '../adapters/sqlite/sqlite-inbox-repository';
import { createNoneWaker } from '../adapters/wake/none-waker';
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
import { reviveAgentName, revokeAgentState } from './agent-revocation';
import { nextAlarmAt } from './alarm-time';
import { isAccountActive, isConnectionAdmitted } from './connection-admission';
import { ALARM_MIN_DELAY_MS, AlarmErrorCode, CONNECTION_NOT_ACTIVE_MESSAGE, TOMBSTONE_STORAGE_KEY } from './constants';
import { createSqliteDeletionRequests } from './deletion-requests';
import { createSqliteFirstMessageClaim } from './first-message-claim';
import { redactInstallCodes } from './install-code-redaction';
import { ACCOUNT_INBOX_MIGRATIONS } from './migrations';
import { runMigrations } from './run-migrations';

type ReceiveAccountMessageRequest = Parameters<AccountOwnerRpc['receiveAccountMessage']>[0];
type ReceiveOwnerMessageRequest = Parameters<AccountInboxRpc['receiveOwnerMessage']>[0];

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc, AccountOwnerRpc {
  protected sender!: MessageSender;
  protected clock!: DurableClock;
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
    this.accountDependencies = {
      ...this.dependencies,
      accounts: new D1AccountDirectory({ database: this.env.CONNECTIONS }),
      connections: new D1ConnectionRegistry({ database: this.env.CONNECTIONS }),
      connectionSecrets: createConnectionSecrets(),
      installCodeVault: createInstallCodeVault(),
      revocations: {
        recordRevocation: ({ agent }) => this.recordRevocation({ agent }),
        recordCreation: ({ agent }) => this.recordCreation({ agent }),
        cancelWaiters: ({ agent }) => this.cancelWaiters({ agent }),
      },
      firstMessage: createSqliteFirstMessageClaim({ storage: this.ctx.storage }),
      deletionRequests: createSqliteDeletionRequests({ storage: this.ctx.storage }),
      installLinkRedaction: { redact: async ({ messageIds }) => redactInstallCodes({ storage: this.ctx.storage, messageIds }) },
    };
    this.dueTimeProviders.push(this.createExpiryProvider(), this.createRoutingListProvider());
    await this.armAlarm();
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
    this.assertLive();
    if (input.connection !== undefined) {
      const isAdmitted = await isConnectionAdmitted({ database: this.env.CONNECTIONS, connection: input.connection });
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
      const event = error.code === ChannelErrorKind.DeliveryFailed ? LogEvent.SendFailed : LogEvent.ToolError;
      this.log({ event, errorCode: error.code });
      return { ok: false, errorCode: error.code, message: error.message };
    } finally {
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
    return this.outcome({ run: () => inbox.checkInbox({ ...input, dependencies: this.dependencies }), connection: input.connection });
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
      run: () => inbox.receiveAccountMessage({ ...input, dependencies: this.accountDependencies }),
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
  }

  async recordCreation(input: { agent: string }): Promise<void> {
    this.assertLive();
    reviveAgentName({ storage: this.ctx.storage, agent: input.agent });
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
  }

  receiveOwnerMessage(input: ReceiveOwnerMessageRequest): Promise<CallOutcome<inbox.ReceiveResult>> {
    return this.outcome({
      run: () => inbox.receiveOwnerMessage({ ...input, dependencies: this.dependencies }),
      describe: (value) => ({ event: value.duplicate ? LogEvent.OwnerMessageDuplicate : LogEvent.OwnerMessage }),
    });
  }

  receiveChannelMessage(input: AgentRequest<inbox.ReceiveChannelInput>): Promise<CallOutcome<inbox.ReceiveResult>> {
    return this.outcome({
      run: () => inbox.receiveChannelMessage({ ...input, dependencies: this.dependencies }),
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
