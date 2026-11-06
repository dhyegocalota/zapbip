import {
  InboxError,
  parseEmoji,
  parseTimeoutMs,
  type AskResult,
  type MediaMessageKind,
  type MediaSource,
  type WaitForReplyResult,
} from '@zapbip/core';
import { InboxErrorCode, MediaSourceKind, ReplyStatus } from '@zapbip/types';
import type { z } from 'zod';
import {
  askInputShape,
  checkInboxInputShape,
  createUploadInputShape,
  getMessagesInputShape,
  reactInputShape,
  sendContactInputShape,
  sendLocationInputShape,
  sendMediaInputShape,
  sendMessageInputShape,
  setWakeInputShape,
  waitForReplyInputShape,
} from '../contract/mcp-schemas';
import { McpToolName } from '../contract/tool-definitions';
import { readInlineImages } from './inline-images';
import { buildUploadLink } from './links';
import { unwrapOutcome } from './tool-error';
import type { ToolContext, ToolSuccess } from './types';
import { toIsoTimestamp, toWireMessages } from './wire';

type ToolArguments<Shape extends z.ZodRawShape> = z.infer<z.ZodObject<Shape>>;
type ToolHandler<Shape extends z.ZodRawShape> = (input: { context: ToolContext; arguments: ToolArguments<Shape> }) => Promise<ToolSuccess>;

const MEDIA_SOURCE_REQUIRED_MESSAGE = 'exactly one of url and upload_id is required';

function deliveryResult(input: { messageId: string; delivery: string }): ToolSuccess {
  return { structured: { message_id: input.messageId, delivery: input.delivery }, images: [] };
}

function resolveMediaSource(input: { url: string | null; uploadId: string | null }): MediaSource {
  const { url, uploadId } = input;
  if (url !== null && uploadId === null) return { kind: MediaSourceKind.Link, link: url };
  if (url === null && uploadId !== null) return { kind: MediaSourceKind.Stored, mediaId: uploadId };
  throw new InboxError({ code: InboxErrorCode.InvalidInput, message: MEDIA_SOURCE_REQUIRED_MESSAGE });
}

async function replyResult(input: { context: ToolContext; result: AskResult | WaitForReplyResult }): Promise<ToolSuccess> {
  const { result } = input;
  const empty = { answer: null, message_id: null, question_id: null, messages: null };
  if (result.status === ReplyStatus.Answered) {
    return { structured: { ...empty, status: result.status, answer: result.answer, message_id: result.messageId }, images: [] };
  }
  if (result.status === ReplyStatus.Pending) {
    return { structured: { ...empty, status: result.status, question_id: result.questionId }, images: [] };
  }
  if (result.status === ReplyStatus.Timeout) return { structured: { ...empty, status: result.status }, images: [] };
  const messages = await toWireMessages({ context: input.context, messages: result.messages });
  const images = await readInlineImages({ context: input.context, messages: result.messages });
  return { structured: { ...empty, status: result.status, messages }, images };
}

const sendMessage: ToolHandler<typeof sendMessageInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.sendText({
    connection: context.connection,
    text: toolArguments.text,
    replyToMessageId: toolArguments.reply_to,
  });
  const sent = unwrapOutcome({ outcome });
  return deliveryResult({ messageId: sent.messageId, delivery: sent.delivery });
};

const sendMedia: ToolHandler<typeof sendMediaInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.sendMedia({
    connection: context.connection,
    mediaKind: toolArguments.kind as MediaMessageKind,
    voice: toolArguments.voice,
    source: resolveMediaSource({ url: toolArguments.url, uploadId: toolArguments.upload_id }),
    caption: toolArguments.caption,
    filename: toolArguments.filename,
    replyToMessageId: toolArguments.reply_to,
  });
  const sent = unwrapOutcome({ outcome });
  return deliveryResult({ messageId: sent.messageId, delivery: sent.delivery });
};

const sendLocation: ToolHandler<typeof sendLocationInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.sendLocation({
    connection: context.connection,
    latitude: toolArguments.latitude,
    longitude: toolArguments.longitude,
    name: toolArguments.name,
    address: toolArguments.address,
    replyToMessageId: toolArguments.reply_to,
  });
  const sent = unwrapOutcome({ outcome });
  return deliveryResult({ messageId: sent.messageId, delivery: sent.delivery });
};

const sendContact: ToolHandler<typeof sendContactInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.sendContacts({
    connection: context.connection,
    contacts: toolArguments.contacts,
    replyToMessageId: toolArguments.reply_to,
  });
  const sent = unwrapOutcome({ outcome });
  return deliveryResult({ messageId: sent.messageId, delivery: sent.delivery });
};

const react: ToolHandler<typeof reactInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.react({
    connection: context.connection,
    targetMessageId: toolArguments.message_id,
    emoji: parseEmoji({ emoji: toolArguments.emoji }),
  });
  const sent = unwrapOutcome({ outcome });
  return deliveryResult({ messageId: sent.messageId, delivery: sent.delivery });
};

const ask: ToolHandler<typeof askInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.ask({
    connection: context.connection,
    text: toolArguments.question,
    options: toolArguments.options.map((option) => option.title),
    optionDescriptions: toolArguments.options.some((option) => option.description !== null)
      ? toolArguments.options.map((option) => option.description)
      : [],
    timeoutMs: parseTimeoutMs({ seconds: toolArguments.timeout_seconds }),
  });
  return replyResult({ context, result: unwrapOutcome({ outcome }) });
};

const waitForReply: ToolHandler<typeof waitForReplyInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.waitForReply({
    connection: context.connection,
    questionId: toolArguments.question_id,
    timeoutMs: parseTimeoutMs({ seconds: toolArguments.timeout_seconds }),
  });
  return replyResult({ context, result: unwrapOutcome({ outcome }) });
};

const getMessages: ToolHandler<typeof getMessagesInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.getMessages({ connection: context.connection, limit: toolArguments.limit });
  const { unread, history } = unwrapOutcome({ outcome });
  return {
    structured: {
      unread: await toWireMessages({ context, messages: unread }),
      history: await toWireMessages({ context, messages: history }),
    },
    images: await readInlineImages({ context, messages: unread }),
  };
};

const checkInbox: ToolHandler<typeof checkInboxInputShape> = async ({ context }) => {
  const outcome = await context.accountInbox.checkInbox({ connection: context.connection });
  const { status, messages } = unwrapOutcome({ outcome });
  return {
    structured: { status, messages: await toWireMessages({ context, messages }) },
    images: await readInlineImages({ context, messages }),
  };
};

const createUpload: ToolHandler<typeof createUploadInputShape> = async ({ context, arguments: toolArguments }) => {
  const outcome = await context.accountInbox.createUpload({
    connection: context.connection,
    filename: toolArguments.filename,
    mimeType: toolArguments.mime_type,
    sizeBytes: toolArguments.size_bytes,
  });
  const { uploadId, expiresAt } = unwrapOutcome({ outcome });
  return {
    structured: {
      upload_id: uploadId,
      upload_url: await buildUploadLink({ context, uploadId }),
      expires_at: toIsoTimestamp({ epochMs: expiresAt }),
    },
    images: [],
  };
};

const setWake: ToolHandler<typeof setWakeInputShape> = async () => {
  throw new Error('set_wake is not implemented');
};

export const TOOL_HANDLERS = {
  [McpToolName.SendMessage]: sendMessage,
  [McpToolName.SendMedia]: sendMedia,
  [McpToolName.SendLocation]: sendLocation,
  [McpToolName.SendContact]: sendContact,
  [McpToolName.React]: react,
  [McpToolName.Ask]: ask,
  [McpToolName.WaitForReply]: waitForReply,
  [McpToolName.GetMessages]: getMessages,
  [McpToolName.CheckInbox]: checkInbox,
  [McpToolName.CreateUpload]: createUpload,
  [McpToolName.SetWake]: setWake,
} satisfies Record<McpToolName, unknown>;
