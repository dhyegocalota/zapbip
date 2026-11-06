export enum ConnectorClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
}

export enum ConnectorFrameType {
  Hello = 'hello',
  Messages = 'messages',
  Done = 'done',
  Ping = 'ping',
  Pong = 'pong',
}

export enum ConnectorWakeOutcome {
  Answered = 'answered',
  Failed = 'failed',
  NoSession = 'no_session',
  FallbackNewThread = 'fallback_new_thread',
}

export enum ConnectorSessionSource {
  Pinned = 'pinned',
  Newest = 'newest',
}

export enum ConnectorLogEvent {
  ConnectorConnected = 'connector_connected',
  ConnectorReconnecting = 'connector_reconnecting',
  ConnectorClosed = 'connector_closed',
  ConnectorReplaced = 'connector_replaced',
  MessagesReceived = 'messages_received',
  WakeStarted = 'wake_started',
  WakeFinished = 'wake_finished',
  DoneSent = 'done_sent',
  FrameRejected = 'frame_rejected',
}

export enum FrameRejectionReason {
  BinaryFrame = 'binary_frame',
  FrameTooLarge = 'frame_too_large',
  Malformed = 'malformed',
  UnknownType = 'unknown_type',
}

export const HEARTBEAT_INTERVAL_MS = 25_000;
export const HEARTBEAT_TIMEOUT_MS = 10_000;
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const CONNECTOR_WAKE_TIMEOUT_MS = 900_000;
export const REPLACED_CLOSE_CODE = 4001;
export const UPGRADE_REQUIRED_STATUS = 426;
export const UNAUTHORIZED_STATUS = 401;
export const CONNECTOR_PATH_SUFFIX = '/connector';
export const CONNECTOR_PING_TEXT = JSON.stringify({ type: ConnectorFrameType.Ping });
export const CONNECTOR_PONG_TEXT = JSON.stringify({ type: ConnectorFrameType.Pong });
export const CONNECTOR_INBOX_LIMIT = 50;
export const CONNECTOR_FRAME_MAX_BYTES = 65_536;
export const SESSION_LOOKUP_LIMIT = 200;
export const WAKE_ALLOWED_TOOL = 'mcp__zapbip__send_message';
export const CODEX_ZAPBIP_SERVER_NAME = 'zapbip';
export const CODEX_ALLOWED_TOOL_NAME = 'send_message';
export const CODEX_APPROVAL_MODE = 'approve';
export const CODEX_ACTIVE_WRITER_MESSAGE = 'thread already has an active writer';
export const WAKE_INSTRUCTION = 'Reply to the owner with send_message, briefly, as one WhatsApp message.';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MCP_PATH_SUFFIX = '/mcp';
