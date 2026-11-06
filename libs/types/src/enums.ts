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
}

export enum WakeRung {
  Inbox = 'inbox',
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
}

export enum RoutingRule {
  ButtonReply = 'button_reply',
  QuotedOrReaction = 'quoted_or_reaction',
  AgentMention = 'agent_mention',
  OpenQuestion = 'open_question',
  RecentAgent = 'recent_agent',
  AskOwner = 'ask_owner',
}

export enum InboxErrorCode {
  InvalidInput = 'invalid_input',
  NotFound = 'not_found',
  UploadExpired = 'upload_expired',
  UploadUnavailable = 'upload_unavailable',
}

export enum ForwardedKind {
  None = 'none',
  Forwarded = 'forwarded',
  FrequentlyForwarded = 'frequently_forwarded',
}
