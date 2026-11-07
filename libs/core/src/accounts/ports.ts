import type { AccountState, OwnerLocale, RegisterOutcome, SenderVerdict } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { CoreDependencies, IdGenerator } from '../inbox/ports';
import type {
  AccountLookup,
  AccountRecord,
  ConnectionRecord,
  InstallCodeColumns,
  InstallCodeResolution,
  IssuedInstallCode,
  IssuedSecret,
  NewConnection,
} from './account-types';

export interface AccountDirectory {
  findByWaId(input: { waId: string }): Promise<AccountRecord | null>;
  findOrCreateByWaId(input: {
    waId: string;
    accountId: string;
    initialState: AccountState;
    locale: OwnerLocale;
    homeNumberId: string;
    createdAt: number;
    newAccountsCap: { since: number; limit: number };
  }): Promise<AccountLookup | null>;
  setState(input: { accountId: string; state: AccountState }): Promise<void>;
  listByState(input: { state: AccountState }): Promise<AccountRecord[]>;
  remove(input: { accountId: string }): Promise<void>;
}

export interface ConnectionRegistry {
  register(input: { connection: NewConnection; activeLimit: number }): Promise<RegisterOutcome>;
  findActiveByAgent(input: { accountId: string; agent: AgentName }): Promise<ConnectionRecord | null>;
  listActive(input: { accountId: string }): Promise<ConnectionRecord[]>;
  revoke(input: { accountId: string; agent: AgentName; revokedAt: number }): Promise<boolean>;
  rotate(input: {
    accountId: string;
    agent: AgentName;
    fromDigest: string;
    toDigest: string;
    installCode: InstallCodeColumns;
    rotatedAt: number;
  }): Promise<boolean>;
}

export interface ConnectionSecrets {
  issue(): Promise<IssuedSecret>;
}

export interface InstallCodeVault {
  issue(): Promise<IssuedInstallCode>;
  seal(input: { installCode: string; secret: string }): Promise<string>;
  open(input: { installCode: string; sealed: string }): Promise<string>;
}

export interface InstallCodeDirectory {
  resolve(input: { installCode: string; now: number }): Promise<InstallCodeResolution>;
  recordFirstCall(input: { connectionId: string; calledAt: number }): Promise<void>;
}

export interface SenderGuard {
  admit(input: { waId: string }): Promise<SenderVerdict>;
}

export interface OutboundGuard {
  admit(input: { accountId: string; agentKey: string }): Promise<SenderVerdict>;
}

export interface ConnectionRevocations {
  recordRevocation(input: { accountId: string; agent: AgentName }): Promise<void>;
  recordCreation(input: { accountId: string; agent: AgentName; secretDigest: string }): Promise<void>;
  recordRotation(input: { accountId: string; agent: AgentName; secretDigest: string }): Promise<void>;
  cancelWaiters(input: { accountId: string; agent: AgentName }): Promise<void>;
}

export interface AccountInboxPurge {
  purge(): Promise<void>;
}

export interface AccountMediaPurge {
  deleteAll(input: { accountId: string }): Promise<void>;
}

export interface FirstMessageClaim {
  claim(input: { channelMessageId: string }): Promise<boolean>;
}

export interface DeletionRequests {
  save(input: { requestedAt: number }): Promise<void>;
  find(): Promise<number | null>;
  clear(): Promise<void>;
}

export interface InstallLinkRedaction {
  redact(input: { messageIds: string[] }): Promise<void>;
}

export type AccountDependencies = CoreDependencies & {
  accounts: AccountDirectory;
  connections: ConnectionRegistry;
  connectionSecrets: ConnectionSecrets;
  installCodeVault: InstallCodeVault;
  revocations: ConnectionRevocations;
  firstMessage: FirstMessageClaim;
  deletionRequests: DeletionRequests;
  installLinkRedaction: InstallLinkRedaction;
};

export type AccountLifecycleDependencies = {
  accounts: AccountDirectory;
  accountMedia: AccountMediaPurge;
  ids: IdGenerator;
};
