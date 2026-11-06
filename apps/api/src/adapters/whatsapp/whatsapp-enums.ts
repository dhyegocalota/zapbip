export enum WebhookHubMode {
  Subscribe = 'subscribe',
}

export enum WhatsAppMessageType {
  Text = 'text',
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
  Sticker = 'sticker',
  Location = 'location',
  Contacts = 'contacts',
  Reaction = 'reaction',
  Interactive = 'interactive',
  Button = 'button',
  Unsupported = 'unsupported',
}

export enum WhatsAppInteractiveType {
  ButtonReply = 'button_reply',
  ListReply = 'list_reply',
}

export enum WhatsAppStatusValue {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
  Played = 'played',
  Failed = 'failed',
}

export enum WhatsAppErrorCode {
  WindowClosed = 131047,
  ReactionTargetInvalid = 131009,
  DeliveryFailed = 131026,
  MediaUploadNotAccepted = 131053,
  UnsupportedType = 131051,
  InboundMediaTooLarge = 131052,
  RateLimitedThroughput = 130429,
  RateLimitedTier = 80007,
  RateLimitedApp = 4,
  RateLimitedUser = 131056,
  NumberRestricted = 131048,
  AccountDisabled = 368,
  RecipientIsSender = 131021,
  PhoneNumberNotRegistered = 133010,
  AuthOAuth = 190,
}

export enum WhatsAppTemplateName {
  AgentNotice = 'zapbip_agent_notice',
  AgentQuestion = 'zapbip_agent_question',
}

export enum WhatsAppLanguageCode {
  PortugueseBrazil = 'pt_BR',
  EnglishUs = 'en_US',
}

export enum OperatorEvent {
  InboundForeignNumber = 'inbound.foreign_number',
  InboundUnmapped = 'inbound.unmapped',
  InboundUnsupported = 'inbound.unsupported',
  InboundMediaUnavailable = 'inbound.media_unavailable',
  StatusUnindexed = 'status.unindexed',
  StatusIgnored = 'status.ignored',
  StatusFailedIgnored = 'status.failed.ignored',
  ChannelRestricted = 'channel.restricted',
  ChannelTemplateRejected = 'channel.template_rejected',
  ChannelAuth = 'channel.auth',
  ChannelTimeout = 'channel.timeout',
}

export enum OperatorLogField {
  ErrorCode = 'error_code',
  TemplateName = 'template_name',
  LanguageCode = 'language_code',
  Reason = 'reason',
  MessageKind = 'message_kind',
  UnsupportedType = 'unsupported_type',
  ChannelMessageId = 'channel_message_id',
}

export enum OperatorLogReason {
  MissingSender = 'missing_sender',
  InvalidSender = 'invalid_sender',
  MalformedEntry = 'malformed_entry',
}
