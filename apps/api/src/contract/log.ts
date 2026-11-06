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
}

export type LogFields = {
  event: LogEvent;
  accountId?: string;
  agent?: string;
  messageId?: string;
  kind?: string;
  sizeBytes?: number;
  errorCode?: string;
  connectionId?: string;
  locale?: string;
  count?: number;
  route?: string;
};
