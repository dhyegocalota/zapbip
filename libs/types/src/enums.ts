export enum MessageDirection {
  ToOwner = 'to_owner',
  FromOwner = 'from_owner',
}

export enum MessageSender {
  Owner = 'owner',
  Agent = 'agent',
}

export enum MessageKind {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Sticker = 'sticker',
  Location = 'location',
  Contacts = 'contacts',
  Reaction = 'reaction',
  Choice = 'choice',
}

export enum MediaSourceKind {
  Link = 'link',
  Stored = 'stored',
}

export enum MediaOrigin {
  Upload = 'upload',
  Owner = 'owner',
}

export enum DeliveryState {
  Queued = 'queued',
  Sent = 'sent',
  Failed = 'failed',
  Expired = 'expired',
}

export enum OwnerLocale {
  PortugueseBrazil = 'pt_BR',
  EnglishUs = 'en_US',
}

export enum InboxCopyKey {
  RoutingPrompt = 'routing_prompt',
  RoutingListExpired = 'routing_list_expired',
  RoutingListReminder = 'routing_list_reminder',
  NoAgents = 'no_agents',
  AgentNotListening = 'agent_not_listening',
  AgentAssignedByExpiry = 'agent_assigned_by_expiry',
  NoticeBody = 'notice_body',
  QuestionNoticeBody = 'question_notice_body',
  NoticeQuickReply = 'notice_quick_reply',
  PreviewImage = 'preview_image',
  PreviewVideo = 'preview_video',
  PreviewAudio = 'preview_audio',
  PreviewVoice = 'preview_voice',
  PreviewDocument = 'preview_document',
  PreviewSticker = 'preview_sticker',
  PreviewReaction = 'preview_reaction',
  PreviewLocation = 'preview_location',
  PreviewContacts = 'preview_contacts',
  PreviewChoice = 'preview_choice',
}

export enum WakeCopyKey {
  WakeFailed = 'wake_failed',
}

export enum OptionRender {
  Buttons = 'buttons',
  List = 'list',
}

export enum ReplyStatus {
  Answered = 'answered',
  Pending = 'pending',
  Message = 'message',
  Timeout = 'timeout',
}

export enum InboxStatus {
  Empty = 'empty',
  New = 'new',
}

export enum TemplateKind {
  Notice = 'notice',
  QuestionNotice = 'question_notice',
}

export enum WakeOutcome {
  Woken = 'woken',
  Unreached = 'unreached',
}

export enum AgentWakeReason {
  MessageWaiting = 'message_waiting',
}

export enum WakeMode {
  None = 'none',
  Local = 'local',
  Webhook = 'webhook',
}

export enum WakeRung {
  Inbox = 'inbox',
  Local = 'local',
  Webhook = 'webhook',
}

export enum WakeAttemptOutcome {
  Delivered = 'delivered',
  Retry = 'retry',
  Refused = 'refused',
}

export enum WakeProvider {
  GrokRoutine = 'grok_routine',
  ClaudeRoutine = 'claude_routine',
  GenericWebhook = 'generic',
}

export enum WakeStatus {
  Active = 'active',
  Failing = 'failing',
}

export enum SetWakeStatus {
  Saved = 'saved',
}

export enum WakeLogEventName {
  Scheduled = 'wake.scheduled',
  Dropped = 'wake.dropped',
  Delivered = 'wake.delivered',
  Retry = 'wake.retry',
  Refused = 'wake.refused',
  GaveUp = 'wake.gave_up',
  NoticeFailed = 'wake.notice_failed',
  NoticeSkipped = 'wake.notice_skipped',
}

export enum ChannelErrorKind {
  DeliveryFailed = 'delivery_failed',
}

export enum LinkPurpose {
  Read = 'read',
  Upload = 'upload',
}

export enum IdPrefix {
  Message = 'msg',
  Question = 'qst',
  Media = 'med',
}

export enum RoutingRule {
  ButtonReply = 'button_reply',
  QuotedOrReaction = 'quoted_or_reaction',
  AgentMention = 'agent_mention',
  OpenQuestion = 'open_question',
  RecentAgent = 'recent_agent',
  SingleAgent = 'single_agent',
  AskOwner = 'ask_owner',
}

export enum InboxErrorCode {
  InvalidInput = 'invalid_input',
  NotFound = 'not_found',
  UploadExpired = 'upload_expired',
  UploadUnavailable = 'upload_unavailable',
}

export enum HttpStatus {
  Ok = 200,
  SwitchingProtocols = 101,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PayloadTooLarge = 413,
  UnsupportedMediaType = 415,
  UpgradeRequired = 426,
  BadGateway = 502,
}

export enum InstallClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
  Cursor = 'cursor',
  GeminiCli = 'gemini-cli',
  GrokBot = 'grok-bot',
  ClaudeAi = 'claude-ai',
  ChatGpt = 'chatgpt',
  GrokWeb = 'grok-web',
  Hermes = 'hermes',
  OpenClaw = 'openclaw',
}

export enum DocsLanguage {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
}

export enum DocsOnlyClient {
  AnyMcpClient = 'any-mcp-client',
}

export enum DocsRetentionKind {
  Questions = 'questions',
  Queue = 'queue',
  Media = 'media',
}

export enum McpToolName {
  SendMessage = 'send_message',
  SendMedia = 'send_media',
  SendLocation = 'send_location',
  SendContact = 'send_contact',
  React = 'react',
  Ask = 'ask',
  WaitForReply = 'wait_for_reply',
  GetMessages = 'get_messages',
  CheckInbox = 'check_inbox',
  CreateUpload = 'create_upload',
  SetWake = 'set_wake',
}
