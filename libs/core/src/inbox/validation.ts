import { MessageKind, OptionRender, SECOND_MS } from '@zapbip/types';
import {
  AGENT_NAME_PATTERN,
  ASK_MAX_WAIT_SECONDS,
  BUTTON_MAX_OPTIONS,
  BUTTON_TITLE_MAX_CHARS,
  LIST_ROW_TITLE_MAX_CHARS,
  MEDIA_MAX_BYTES,
  MEDIA_MIME_PREFIX,
  MIME_TYPE_MAX_CHARS,
  QUESTION_MAX_OPTIONS,
  STICKER_MIME_TYPE,
  WAIT_TIMEOUT_MIN_SECONDS,
  type MediaMessageKind,
} from './constants';
import type { AgentName } from './connection';
import { invalidInput } from './inbox-error-factories';

const MIME_TYPE_MIN_CHARS = 3;
const UPLOAD_MAX_BYTES = Math.max(...Object.values(MEDIA_MAX_BYTES));
const LIST_ROW_DESCRIPTION_MAX_CHARS = 72;
const HTTPS_PROTOCOL = 'https:';
const WHITESPACE_PATTERN = /\s+/g;
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;
const VOWEL_PATTERN = /^[aeiou]/;
const graphemeSegmenter = new Intl.Segmenter();

function countCodePoints(input: { value: string }): number {
  return [...input.value].length;
}

export function parseAgentName(input: { value: string }): AgentName {
  if (!AGENT_NAME_PATTERN.test(input.value)) throw invalidInput({ message: `agent: must match ${AGENT_NAME_PATTERN.source}` });
  return input.value;
}

export function normalizeText(input: { value: string }): string {
  return input.value.normalize('NFC').trim().replace(WHITESPACE_PATTERN, ' ');
}

export function assertMaxChars(input: { field: string; value: string; maxChars: number }): void {
  if (input.value.trim().length === 0) throw invalidInput({ message: `${input.field}: must not be empty` });
  if (countCodePoints({ value: input.value }) > input.maxChars)
    throw invalidInput({ message: `${input.field}: must be at most ${input.maxChars} characters` });
}

export function parseOptions(input: { options: string[] }): { render: OptionRender; titles: string[] } {
  const hasValidCount = input.options.length >= 1 && input.options.length <= QUESTION_MAX_OPTIONS;
  if (!hasValidCount) throw invalidInput({ message: `options: must have 1 to ${QUESTION_MAX_OPTIONS} entries` });
  const render = input.options.length <= BUTTON_MAX_OPTIONS ? OptionRender.Buttons : OptionRender.List;
  const maxChars = render === OptionRender.Buttons ? BUTTON_TITLE_MAX_CHARS : LIST_ROW_TITLE_MAX_CHARS;
  const label = render === OptionRender.Buttons ? 'button title' : 'list row title';
  const titles = input.options.map((option, index) => {
    const title = normalizeText({ value: option });
    if (title.length === 0) throw invalidInput({ message: `options[${index}]: must not be empty` });
    if (countCodePoints({ value: title }) > maxChars)
      throw invalidInput({ message: `options[${index}]: ${label} must be at most ${maxChars} characters` });
    return title;
  });
  return { render, titles };
}

export function parseTimeoutMs(input: { seconds: number }): number {
  const isInRange = Number.isInteger(input.seconds) && input.seconds >= WAIT_TIMEOUT_MIN_SECONDS && input.seconds <= ASK_MAX_WAIT_SECONDS;
  if (!isInRange)
    throw invalidInput({ message: `timeout_seconds: must be between ${WAIT_TIMEOUT_MIN_SECONDS} and ${ASK_MAX_WAIT_SECONDS}` });
  return input.seconds * SECOND_MS;
}

export function parseEmoji(input: { emoji: string }): string | null {
  if (input.emoji.length === 0) return null;
  const isOneEmoji = [...graphemeSegmenter.segment(input.emoji)].length === 1 && EMOJI_PATTERN.test(input.emoji);
  if (!isOneEmoji) throw invalidInput({ message: 'emoji: must be one emoji' });
  return input.emoji;
}

export function assertHttpsLink(input: { value: string }): void {
  const isHttps = URL.canParse(input.value) && new URL(input.value).protocol === HTTPS_PROTOCOL;
  if (!isHttps) throw invalidInput({ message: 'link: must be an https URL' });
}

export function assertMediaFits(input: { kind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void {
  const maxBytes = MEDIA_MAX_BYTES[input.kind];
  const mimePrefix = MEDIA_MIME_PREFIX[input.kind];
  const exceedsSize = input.sizeBytes !== null && input.sizeBytes > maxBytes;
  if (exceedsSize) throw invalidInput({ message: `size_bytes: ${input.kind} must be at most ${maxBytes} bytes` });
  const isWrongSticker = input.kind === MessageKind.Sticker && input.mimeType !== null && input.mimeType !== STICKER_MIME_TYPE;
  if (isWrongSticker) throw invalidInput({ message: `mime_type: ${input.kind} must be ${STICKER_MIME_TYPE}` });
  const isWrongPrefix = mimePrefix !== null && input.mimeType !== null && !input.mimeType.startsWith(mimePrefix);
  const article = VOWEL_PATTERN.test(input.kind) ? 'an' : 'a';
  if (isWrongPrefix) throw invalidInput({ message: `mime_type: ${input.kind} must be ${article} ${mimePrefix}* type` });
}

export function assertVoiceNote(input: { kind: MediaMessageKind; voice: boolean }): void {
  if (input.voice && input.kind !== MessageKind.Audio) throw invalidInput({ message: 'voice: only audio can be a voice note' });
}

export function assertUploadDeclaration(input: { mimeType: string; sizeBytes: number }): void {
  if (!(input.sizeBytes >= 1)) throw invalidInput({ message: 'size_bytes: must be at least 1' });
  if (input.sizeBytes > UPLOAD_MAX_BYTES) throw invalidInput({ message: `size_bytes: must be at most ${UPLOAD_MAX_BYTES} bytes` });
  if (input.mimeType.length < MIME_TYPE_MIN_CHARS)
    throw invalidInput({ message: `mime_type: must be at least ${MIME_TYPE_MIN_CHARS} characters` });
  if (input.mimeType.length > MIME_TYPE_MAX_CHARS)
    throw invalidInput({ message: `mime_type: must be at most ${MIME_TYPE_MAX_CHARS} characters` });
}

export function parseOptionDescriptions(input: { descriptions: (string | null)[] }): (string | null)[] {
  return input.descriptions.map((description, index) => {
    if (description === null) return null;
    const normalized = normalizeText({ value: description });
    if (countCodePoints({ value: normalized }) > LIST_ROW_DESCRIPTION_MAX_CHARS)
      throw invalidInput({ message: `options[${index}]: description must be at most ${LIST_ROW_DESCRIPTION_MAX_CHARS} characters` });
    return normalized.length === 0 ? null : normalized;
  });
}
