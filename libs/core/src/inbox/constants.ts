import { BYTES_PER_MEGABYTE, DAY_MS, HOUR_MS, MessageKind, MINUTE_MS, SECOND_MS } from '@zapbip/types';

export const ASK_MAX_WAIT_MS = 50 * SECOND_MS;
export const ASK_MAX_WAIT_SECONDS = ASK_MAX_WAIT_MS / SECOND_MS;
export const WAIT_TIMEOUT_MIN_SECONDS = 1;
export const ASK_RETRY_WINDOW_MS = 4 * MINUTE_MS;
export const WINDOW_MS = DAY_MS;
export const WINDOW_SAFETY_MARGIN_MS = 10 * MINUTE_MS;
export const HISTORY_LIMIT = 20;
export const QUESTION_RETENTION_MS = 7 * DAY_MS;
export const QUEUE_RETENTION_MS = 7 * DAY_MS;
export const RECEIPT_RETENTION_MS = 7 * DAY_MS;
export const FLUSH_CLAIM_LIMIT = 20;
export const SENDING_STALE_MS = 60 * SECOND_MS;
export const MEDIA_RETENTION_MS = 30 * DAY_MS;
export const MEDIA_LINK_TTL_MS = HOUR_MS;
export const UPLOAD_TTL_MS = 15 * MINUTE_MS;
export const UPLOAD_CLAIM_TTL_MS = UPLOAD_TTL_MS;
export const ROUTING_LIST_TTL_MS = 10 * MINUTE_MS;
export const INLINE_IMAGE_MAX_BYTES = 1 * BYTES_PER_MEGABYTE;
export const NOTICE_PREVIEW_MAX_CHARS = 60;

export const WHATSAPP_TEXT_MAX_CHARS = 4096;
export const CAPTION_MAX_CHARS = 1024;
export const FILENAME_MAX_CHARS = 240;
export const MIME_TYPE_MAX_CHARS = 127;
export const QUESTION_MAX_CHARS = 1024;
export const QUESTION_MAX_OPTIONS = 10;
export const BUTTON_MAX_OPTIONS = 3;
export const BUTTON_TITLE_MAX_CHARS = 20;
export const LIST_ROW_TITLE_MAX_CHARS = 24;
export const CONTACTS_MAX_PER_MESSAGE = 10;
export const EMOJI_MAX_GRAPHEMES = 1;

export const AGENT_NAME_MAX_CHARS = 20;
export const AGENT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,19}$/;
export const AGENT_MENTION_PATTERN = /^@([a-z0-9][a-z0-9-]{0,19}) /;

export const IMAGE_MAX_BYTES = 5 * BYTES_PER_MEGABYTE;
export const VIDEO_MAX_BYTES = 16 * BYTES_PER_MEGABYTE;
export const AUDIO_MAX_BYTES = 16 * BYTES_PER_MEGABYTE;
export const DOCUMENT_MAX_BYTES = 100 * BYTES_PER_MEGABYTE;
export const STICKER_MAX_BYTES = 100_000;
export const STICKER_MIME_TYPE = 'image/webp';
export const SVG_MIME_TYPE = 'image/svg+xml';

export type MediaMessageKind = MessageKind.Image | MessageKind.Video | MessageKind.Audio | MessageKind.Document | MessageKind.Sticker;

export const MEDIA_MAX_BYTES: Record<MediaMessageKind, number> = {
  [MessageKind.Image]: IMAGE_MAX_BYTES,
  [MessageKind.Video]: VIDEO_MAX_BYTES,
  [MessageKind.Audio]: AUDIO_MAX_BYTES,
  [MessageKind.Document]: DOCUMENT_MAX_BYTES,
  [MessageKind.Sticker]: STICKER_MAX_BYTES,
};

export const MEDIA_MIME_PREFIX: Record<MediaMessageKind, string | null> = {
  [MessageKind.Image]: 'image/',
  [MessageKind.Video]: 'video/',
  [MessageKind.Audio]: 'audio/',
  [MessageKind.Document]: null,
  [MessageKind.Sticker]: null,
};

export const NOTICE_QUICK_REPLY_ID = 'zapbip_open_window';
export const ROUTE_OPTION_PREFIX = 'route';
