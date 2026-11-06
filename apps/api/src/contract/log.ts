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
}

export type LogFields = {
  event: LogEvent;
  accountId?: string;
  agent?: string;
  messageId?: string;
  kind?: string;
  sizeBytes?: number;
  errorCode?: string;
};
