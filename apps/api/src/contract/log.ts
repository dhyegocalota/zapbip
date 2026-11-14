import type { WakeAttemptOutcome, WakeLogEventName, WakeProviderId } from '@zapbip/types';

export enum LogEvent {
  AuthRejected = 'auth_rejected',
  ToolCall = 'tool_call',
  ToolError = 'tool_error',
  AgentChange = 'agent_change',
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
  AccessInviteRedeemed = 'access_invite_redeemed',
  AccessNoticeFailed = 'access_notice_failed',
  AccessReleaseFailed = 'access_release_failed',
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
  StartLinkFailed = 'start_link.failed',
  StartLinkInvalidNumber = 'start_link.invalid_number',
  BackofficeSignInFailed = 'backoffice.sign_in_failed',
  BackofficeSignInSucceeded = 'backoffice.sign_in_succeeded',
  BackofficeLocked = 'backoffice.locked',
  BackofficeCsrfRejected = 'backoffice.csrf_rejected',
  BackofficeNumberChanged = 'backoffice.number_changed',
  BackofficeError = 'backoffice.error',
  BackofficeAgentKeyRejected = 'backoffice.agent_key_rejected',
  BackofficeAgentToolCall = 'backoffice.agent_tool_call',
  SiteTurnstileFailed = 'site.turnstile_failed',
  SiteRepositoryStarsFailed = 'site.repository_stars_failed',
  SiteError = 'site.error',
  ClientAppError = 'client_app.error',
  PackageUnavailable = 'package_unavailable',
  ActivityRecordFailed = 'activity_record_failed',
  EmailSendFailed = 'email.send_failed',
  EmailDisabled = 'email.disabled',
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
  provider?: WakeProviderId | null;
  attempt?: number;
  statusCode?: number | null;
  latencyMs?: number | null;
  outcome?: WakeAttemptOutcome | null;
};
