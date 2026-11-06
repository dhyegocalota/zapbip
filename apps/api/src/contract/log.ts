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
  ClockAdvanced = 'clock_advanced',
  FrameRejected = 'frame_rejected',
}

export type LogFields = {
  event: LogEvent | WakeLogEventName;
  accountId?: string;
  agent?: string;
  messageId?: string;
  kind?: string;
  sizeBytes?: number;
  errorCode?: string;
  provider?: WakeProvider | null;
  attempt?: number;
  statusCode?: number | null;
  latencyMs?: number | null;
  outcome?: WakeAttemptOutcome | null;
};
