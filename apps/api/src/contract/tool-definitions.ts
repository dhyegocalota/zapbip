import { SCHEDULED_MAX_INTERVAL_MINUTES, SCHEDULED_MIN_INTERVAL_MINUTES } from '@zapbip/core';
import { McpToolName } from '@zapbip/types';
import type { ZodRawShape, ZodType } from 'zod';
import {
  accountChangeOutputShape,
  accountStatusInputShape,
  accountStatusOutputShape,
  askInputShape,
  checkInboxInputShape,
  checkInboxOutputShape,
  connectAgentInputShape,
  createUploadInputShape,
  createUploadOutputShape,
  deliveryResultOutputShape,
  getMessagesInputShape,
  getMessagesOutputShape,
  listAgentsInputShape,
  listAgentsOutputShape,
  reactInputShape,
  replyResultOutputShape,
  revokeAgentInputShape,
  sendContactInputShape,
  sendLocationInputShape,
  sendMediaInputShape,
  sendMessageInputShape,
  setWakeOutputShape,
  signInLinkInputShape,
  setWakeInputSchema,
  waitForReplyInputShape,
} from './mcp-schemas';

export { McpToolName };

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
    description: `Set how this agent is woken when the owner writes: a webhook url and token, scheduled with interval_minutes (${SCHEDULED_MIN_INTERVAL_MINUTES} to ${SCHEDULED_MAX_INTERVAL_MINUTES}) when this agent polls check_inbox on a schedule, standby with standby_agent (another agent of the same account that answers for this one) when it cannot be woken, local when the zapbip connector runs on the computer of the owner, or none to clear it. Fields of another mode must be absent.`,
    inputShape: setWakeInputSchema,
    outputShape: setWakeOutputShape,
  },
  [McpToolName.ListAgents]: {
    description: 'List the agents connected to this account with their client, when each was created and when it was last active.',
    inputShape: listAgentsInputShape,
    outputShape: listAgentsOutputShape,
  },
  [McpToolName.AccountStatus]: {
    description: 'Read the account: its state, the masked phone, the plan and the free messages the plan includes.',
    inputShape: accountStatusInputShape,
    outputShape: accountStatusOutputShape,
  },
  [McpToolName.ConnectAgent]: {
    description:
      'Connect a new agent by name. The owner is asked on WhatsApp and the call waits for the answer; nothing changes on deny or timeout. The install link goes to the owner unless the owner taps the button that sends it to this agent, and only then does install_prompt carry it.',
    inputShape: connectAgentInputShape,
    outputShape: accountChangeOutputShape,
  },
  [McpToolName.RevokeAgent]: {
    description:
      'Revoke an agent of this account by name. The owner is asked on WhatsApp and the call waits for the answer; nothing changes on deny or timeout.',
    inputShape: revokeAgentInputShape,
    outputShape: accountChangeOutputShape,
  },
  [McpToolName.SignInLink]: {
    description:
      'Send the owner a one-time sign-in link to the zapbip web app on WhatsApp. The link never comes back to the agent. Deleting the account is only possible by WhatsApp command and has no tool.',
    inputShape: signInLinkInputShape,
    outputShape: accountChangeOutputShape,
  },
};
