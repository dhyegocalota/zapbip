import type {
  AccountReplyIntent,
  AccountReplyParameter,
  AccountState,
  AccountStateOutcome,
  CommandKind,
  InstallCodeStatus,
  OwnerLocale,
  ReplyKind,
} from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type AccountRecord = {
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
  homeNumberId: string | null;
};

export type AccountLookup = { account: AccountRecord; created: boolean };

export type InstallCodeColumns = {
  installCodeDigest: string | null;
  installCodeSealedSecret: string | null;
  installCodeExpiresAt: number | null;
};

export type ConnectionRecord = InstallCodeColumns & {
  connectionId: string;
  accountId: string;
  agent: AgentName;
  secretDigest: string;
  clientName: string | null;
  firstCallAt: number | null;
  createdAt: number;
};

export type NewConnection = Omit<ConnectionRecord, 'clientName' | 'firstCallAt'>;

export type OwnerAccountContext = {
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
};

export type AccountCommand = {
  kind: CommandKind;
  rawName: string | null;
  locale: OwnerLocale;
};

export type MenuRow = { id: string; title: string };

export type AccountReply = {
  intent: AccountReplyIntent;
  kind: ReplyKind;
  locale: OwnerLocale;
  parameters: Partial<Record<AccountReplyParameter, string>>;
  menuRows: MenuRow[];
};

export type AccountCompensation = {
  connectionId: string;
  agent: AgentName;
  oldDigest: string | null;
  newDigest: string;
  oldInstallCode: InstallCodeColumns;
};

export type AccountCommandResult = {
  replies: AccountReply[];
  compensation: AccountCompensation | null;
  deletionConfirmed: boolean;
  connectionId: string | null;
};

export type IssuedSecret = { secret: string; digest: string };

export type IssuedInstallCode = { installCode: string; digest: string };

export type InstallCodeResolution =
  | {
      status: InstallCodeStatus.Ready;
      connectionLink: string;
      locale: OwnerLocale;
      agent: AgentName;
      accountId: string;
      connectionId: string;
    }
  | { status: InstallCodeStatus.Expired | InstallCodeStatus.Used; locale: OwnerLocale }
  | { status: InstallCodeStatus.Unknown; locale: null };

export type CommandInput = {
  text: string | null;
  listReplyId: string | null;
  isQuoting: boolean;
  locale: OwnerLocale;
};

export type AccountStateVerdict = {
  outcome: AccountStateOutcome;
  intent: AccountReplyIntent | null;
};
