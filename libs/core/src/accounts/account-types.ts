import type {
  AccountReplyIntent,
  AccountReplyParameter,
  AccountState,
  AccountStateOutcome,
  CommandKind,
  OwnerLocale,
  ReplyKind,
} from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type AccountRecord = {
  accountId: string;
  waId: string;
  state: AccountState;
  locale: OwnerLocale;
};

export type AccountLookup = { account: AccountRecord; created: boolean };

export type ConnectionRecord = {
  connectionId: string;
  accountId: string;
  agent: AgentName;
  secretDigest: string;
  createdAt: number;
};

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
};

export type AccountCommandResult = {
  replies: AccountReply[];
  compensation: AccountCompensation | null;
  deletionConfirmed: boolean;
};

export type IssuedSecret = { secret: string; digest: string };

export type CommandInput = {
  text: string | null;
  listReplyId: string | null;
  isQuoting: boolean;
};

export type AccountStateVerdict = {
  outcome: AccountStateOutcome;
  intent: AccountReplyIntent | null;
};
