import type { ZodRawShape, ZodType } from 'zod';
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
  setWakeInputSchema,
  waitForReplyInputShape,
} from './mcp-schemas';

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

export type ToolDefinition = {
  description: string;
  inputShape: ZodRawShape | ZodType;
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
    description:
      'Set how this agent is woken when the owner writes: a webhook url and token, scheduled with interval_minutes (1 to 1440) when this agent polls check_inbox on a schedule, standby with standby_agent (another agent of the same account that answers for this one) when it cannot be woken, local when the zapbip connector runs on the computer of the owner, or none to clear it.',
    inputShape: setWakeInputSchema,
    outputShape: setWakeOutputShape,
  },
};
