import { McpToolName } from '@zapbip/types';
import type { ZodRawShape } from 'zod';
import {
  askInputShape,
  checkInboxInputShape,
  checkInboxOutputShape,
  createUploadInputShape,
  createUploadOutputShape,
  deliveryResultOutputShape,
  getMessagesInputShape,
  getMessagesOutputShape,
  reactInputShape,
  replyResultOutputShape,
  sendContactInputShape,
  sendLocationInputShape,
  sendMediaInputShape,
  sendMessageInputShape,
  setWakeOutputShape,
  setWakeToolInputShape,
  waitForReplyInputShape,
} from './mcp-schemas';

export { McpToolName };

export type ToolDefinition = {
  description: string;
  inputShape: ZodRawShape;
  outputShape: ZodRawShape;
};

export const TOOL_DEFINITIONS: Record<McpToolName, ToolDefinition> = {
  [McpToolName.SendMessage]: {
    description: "Send a text message to the owner's WhatsApp.",
    inputShape: sendMessageInputShape,
    outputShape: deliveryResultOutputShape,
  },
  [McpToolName.SendMedia]: {
    description: 'Send an image, video, audio, document or sticker, from a public https link or an upload id.',
    inputShape: sendMediaInputShape,
    outputShape: deliveryResultOutputShape,
  },
  [McpToolName.SendLocation]: {
    description: 'Send a location pin.',
    inputShape: sendLocationInputShape,
    outputShape: deliveryResultOutputShape,
  },
  [McpToolName.SendContact]: {
    description: 'Send one or more contact cards.',
    inputShape: sendContactInputShape,
    outputShape: deliveryResultOutputShape,
  },
  [McpToolName.React]: {
    description: 'React to a message with one emoji, or clear the reaction.',
    inputShape: reactInputShape,
    outputShape: deliveryResultOutputShape,
  },
  [McpToolName.Ask]: {
    description: 'Ask the owner a question, with optional buttons or list options, and wait for the answer.',
    inputShape: askInputShape,
    outputShape: replyResultOutputShape,
  },
  [McpToolName.WaitForReply]: {
    description: 'Wait for the answer to a pending question, or for the next owner message.',
    inputShape: waitForReplyInputShape,
    outputShape: replyResultOutputShape,
  },
  [McpToolName.GetMessages]: {
    description: 'Read the unread messages and the recent history of this agent.',
    inputShape: getMessagesInputShape,
    outputShape: getMessagesOutputShape,
  },
  [McpToolName.CheckInbox]: {
    description: 'Check whether the owner has written to this agent, and read the new messages.',
    inputShape: checkInboxInputShape,
    outputShape: checkInboxOutputShape,
  },
  [McpToolName.CreateUpload]: {
    description: 'Reserve an upload for bytes that have no public link; PUT the bytes to the returned URL.',
    inputShape: createUploadInputShape,
    outputShape: createUploadOutputShape,
  },
  [McpToolName.SetWake]: {
    description: 'Set how this agent is woken when the owner writes: a webhook url and token, or none to clear it.',
    inputShape: setWakeToolInputShape,
    outputShape: setWakeOutputShape,
  },
};
