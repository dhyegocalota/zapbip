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
  Unavailable = 'unavailable',
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
  Delivered = 'delivered',
  Read = 'read',
  Sending = 'sending',
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
  ExpectedDelayNote = 'expected_delay_note',
  StaleNotice = 'stale_notice',
  CadenceHourly = 'cadence_hourly',
  CadenceHours = 'cadence_hours',
  CadenceMinute = 'cadence_minute',
  CadenceMinutes = 'cadence_minutes',
  ElapsedMinutes = 'elapsed_minutes',
  ElapsedHours = 'elapsed_hours',
  NeverPolled = 'never_polled',
}

export enum OptionRender {
  Buttons = 'buttons',
  List = 'list',
}

export enum WaiterEnd {
  Resolved = 'resolved',
  Cancelled = 'cancelled',
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
  StandbyFor = 'standby_for',
}

export enum WakeMode {
  None = 'none',
  Local = 'local',
  Webhook = 'webhook',
  Scheduled = 'scheduled',
  Standby = 'standby',
}

export enum WakeRung {
  Inbox = 'inbox',
  Local = 'local',
  Webhook = 'webhook',
  Scheduled = 'scheduled',
  Standby = 'standby',
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
  WindowClosed = 'window_closed',
  RateLimited = 'rate_limited',
  Restricted = 'restricted',
  ReactionRejected = 'reaction_rejected',
  MediaRejected = 'media_rejected',
  TemplateRejected = 'template_rejected',
  Timeout = 'timeout',
  Auth = 'auth',
  Unknown = 'unknown',
}

export enum ChannelInboundKind {
  Owner = 'owner',
  WindowOnly = 'window_only',
  Unsupported = 'unsupported',
}

export enum LinkPurpose {
  Read = 'read',
  Upload = 'upload',
}

export enum IdPrefix {
  Message = 'msg',
  Question = 'qst',
  Media = 'med',
  Account = 'acc',
  Connection = 'con',
}

export enum RoutingRule {
  ButtonReply = 'button_reply',
  QuotedOrReaction = 'quoted_or_reaction',
  AgentMention = 'agent_mention',
  OpenQuestion = 'open_question',
  RecentAgent = 'recent_agent',
  SingleAgent = 'single_agent',
  AskOwner = 'ask_owner',
  AccountCommand = 'account_command',
}

export enum InboxErrorCode {
  InvalidInput = 'invalid_input',
  NotFound = 'not_found',
  UploadExpired = 'upload_expired',
  UploadUnavailable = 'upload_unavailable',
}

export enum AccountState {
  Waitlisted = 'waitlisted',
  Active = 'active',
  Suspended = 'suspended',
  Deleting = 'deleting',
}

export enum CommandKind {
  CreateAgent = 'create_agent',
  ListAgents = 'list_agents',
  RevokeAgent = 'revoke_agent',
  RotateAgent = 'rotate_agent',
  Help = 'help',
  RequestDeletion = 'request_deletion',
  ConfirmDeletion = 'confirm_deletion',
  Unknown = 'unknown',
}

export enum SenderVerdict {
  Admitted = 'admitted',
  Blocked = 'blocked',
  RateLimited = 'rate_limited',
}

export enum RegisterOutcome {
  Registered = 'registered',
  LimitReached = 'limit_reached',
  NameTaken = 'name_taken',
}

export enum AccountStateOutcome {
  Proceed = 'proceed',
  Reply = 'reply',
  Drop = 'drop',
}

export enum ReplyKind {
  Text = 'text',
  List = 'list',
}

export enum AccountReplyIntent {
  Waitlisted = 'waitlisted',
  Suspended = 'suspended',
  Created = 'created',
  InvalidName = 'invalid_name',
  ReservedName = 'reserved_name',
  NameTaken = 'name_taken',
  LimitReached = 'limit_reached',
  NotFound = 'not_found',
  Revoked = 'revoked',
  Rotated = 'rotated',
  Listed = 'listed',
  EmptyList = 'empty_list',
  Usage = 'usage',
  Menu = 'menu',
  DeletionRequest = 'deletion_request',
  DeletionExpired = 'deletion_expired',
  DeletionDone = 'deletion_done',
  SendFailed = 'send_failed',
  Unknown = 'unknown',
}

export enum InstallCodeStatus {
  Ready = 'ready',
  Expired = 'expired',
  Used = 'used',
  Unknown = 'unknown',
}

export enum AccountReplyParameter {
  AgentName = 'agent_name',
  Limit = 'limit',
  Usage = 'usage',
  Phrase = 'phrase',
  Agents = 'agents',
  InstallPrompt = 'install_prompt',
}

export enum HttpStatus {
  SwitchingProtocols = 101,
  Ok = 200,
  Created = 201,
  MultipleChoices = 300,
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
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable = 503,
}
