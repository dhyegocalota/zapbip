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
  StaleElapsedMinutes = 'stale_elapsed_minutes',
  StaleElapsedHours = 'stale_elapsed_hours',
  StaleNeverPolled = 'stale_never_polled',
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
  Number = 'num',
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
  Login = 'login',
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
  SignInLink = 'sign_in_link',
  SendFailed = 'send_failed',
  AccessOpened = 'access_opened',
  WindowClosed = 'window_closed',
  CoolingDown = 'cooling_down',
  Unknown = 'unknown',
}

export enum AccessReleaseOutcome {
  Released = 'released',
  AlreadyActive = 'already_active',
  NotWaitlisted = 'not_waitlisted',
  NotFound = 'not_found',
}

export enum AccessNoticeOutcome {
  Sent = 'sent',
  Queued = 'queued',
  Failed = 'failed',
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
  SignInLink = 'sign_in_link',
  AppLink = 'app_link',
}

export enum HttpStatus {
  SwitchingProtocols = 101,
  Ok = 200,
  Created = 201,
  MultipleChoices = 300,
  MovedPermanently = 301,
  Found = 302,
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
  UnprocessableEntity = 422,
  TooManyRequests = 429,
  InternalServerError = 500,
  BadGateway = 502,
  ServiceUnavailable = 503,
}

export enum DocsLanguage {
  English = 'en',
  PortugueseBrazil = 'pt-BR',
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
  ListAgents = 'list_agents',
  AccountStatus = 'account_status',
  ConnectAgent = 'connect_agent',
  RevokeAgent = 'revoke_agent',
  SignInLink = 'sign_in_link',
}

export enum AgentChangeStatus {
  Applied = 'applied',
  Denied = 'denied',
  TimedOut = 'timed_out',
  Refused = 'refused',
}

export enum AgentCommandRecipient {
  Owner = 'owner',
  Agent = 'agent',
}

export enum AccountPlan {
  Free = 'free',
}

export enum WhatsAppNumberState {
  Pending = 'pending',
  Active = 'active',
  Closed = 'closed',
  Disabled = 'disabled',
}

export enum SiteSettingKey {
  WaitlistReferralCap = 'waitlist_referral_cap',
}

export enum WaitlistJoinOutcome {
  Joined = 'joined',
  AlreadyJoined = 'already_joined',
  Unavailable = 'unavailable',
  CaptchaFailed = 'captcha_failed',
  InvalidEmail = 'invalid_email',
  RateLimited = 'rate_limited',
}

export enum WaitlistSource {
  Form = 'form',
  Agent = 'agent',
}

export enum PricingCurrency {
  Usd = 'usd',
  Brl = 'brl',
}
