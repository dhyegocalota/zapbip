import type { WakeAttemptOutcome, WakeLogEventName, WakeProvider } from '@zapbip/types';

export enum LogEvent {
  AuthRejected = 'auth_rejected',
  ToolCall = 'tool_call',
  ToolError = 'tool_error',
  OwnerMessage = 'owner_message',
  OwnerMessageDuplicate = 'owner_message_duplicate',
  Send = 'send',
  SendFailed = 'send_failed',
  Upload = 'upload',
  MediaRead = 'media_read',
  Sweep = 'sweep',
  OwnerNoticeFailed = 'owner_notice_failed',
  ClockAdvanced = 'clock_advanced',
  AccountCreated = 'account_created',
  AccountStateChanged = 'account_state_changed',
  CommandReceived = 'command_received',
  ConnectionCreated = 'connection_created',
  ConnectionRevoked = 'connection_revoked',
  ConnectionRotated = 'connection_rotated',
  ConnectionCompensated = 'connection_compensated',
  SenderBlocked = 'sender_blocked',
  SenderRateLimited = 'sender_rate_limited',
  AccountDailyCap = 'account_daily_cap',
  AccountDeleted = 'account_deleted',
  InstallCodeUnreadable = 'install_code_unreadable',
  BudgetWarning = 'budget.warning',
  FrameRejected = 'frame_rejected',
  InstallPageFailed = 'install_page_failed',
  BackofficeSignInFailed = 'backoffice.sign_in_failed',
  BackofficeSignInSucceeded = 'backoffice.sign_in_succeeded',
  BackofficeLocked = 'backoffice.locked',
  BackofficeCsrfRejected = 'backoffice.csrf_rejected',
  BackofficeNumberChanged = 'backoffice.number_changed',
  BackofficeError = 'backoffice.error',
  PackageUnavailable = 'package_unavailable',
}

export type LogFields = {
  event: LogEvent | WakeLogEventName;
  accountId?: string;
  agent?: string;
  messageId?: string;
  kind?: string;
  sizeBytes?: number;
  errorCode?: string;
  connectionId?: string;
  numberId?: string;
  locale?: string;
  count?: number;
  route?: string;
  day?: string;
  gigabyteSeconds?: number;
  provider?: WakeProvider | null;
  attempt?: number;
  statusCode?: number | null;
  latencyMs?: number | null;
  outcome?: WakeAttemptOutcome | null;
};
