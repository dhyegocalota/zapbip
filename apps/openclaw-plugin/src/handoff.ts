import type { Message } from '@zapbip/core';
import { CHANNEL_FORWARDED_PREFIX, CHANNEL_HANDOFF_NO_TEXT_BY_KIND, CHANNEL_SENDER, ConnectorLogEvent, MessageKind } from '@zapbip/types';
import { dispatchInboundDirectDm } from 'openclaw/plugin-sdk/channel-inbound';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-contracts';
import type { ZapbipAccount } from './account';
import { CHANNEL_ID, CHANNEL_LABEL, DIRECT_PEER_KIND } from './constants';
import { logConnectorEvent } from './log';
import { sendOwnerText } from './send-message';

function ownTextOf(input: { message: Message }): string | null {
  const { message } = input;
  if (message.kind === MessageKind.Text) return message.text;
  if (message.kind === MessageKind.Choice) return message.selected === null ? null : message.selected.title;
  if ('caption' in message) return message.caption;
  return null;
}

function unmarkedHandoffTextOf(input: { message: Message }): string {
  const ownText = ownTextOf(input);
  if (ownText === null) return CHANNEL_HANDOFF_NO_TEXT_BY_KIND[input.message.kind];
  return ownText;
}

export function handoffTextOf(input: { message: Message }): string {
  const text = unmarkedHandoffTextOf(input);
  if (input.message.forwarded) return `${CHANNEL_FORWARDED_PREFIX} ${text}`;
  return text;
}

export async function handOffToAgent(input: { cfg: OpenClawConfig; account: ZapbipAccount; message: Message }): Promise<void> {
  const { cfg, account, message } = input;
  const logFailure = () =>
    logConnectorEvent({
      event: ConnectorLogEvent.PluginHandoffFailed,
      fields: { messageId: message.messageId },
    });
  await dispatchInboundDirectDm({
    cfg,
    channel: CHANNEL_ID,
    channelLabel: CHANNEL_LABEL,
    accountId: account.accountId,
    peer: { kind: DIRECT_PEER_KIND, id: CHANNEL_SENDER },
    senderId: CHANNEL_SENDER,
    senderAddress: CHANNEL_SENDER,
    recipientAddress: account.accountId,
    conversationLabel: CHANNEL_SENDER,
    rawBody: handoffTextOf({ message }),
    messageId: message.messageId,
    timestamp: message.at,
    commandAuthorized: !message.forwarded,
    inboundAccessAuthorized: true,
    provider: CHANNEL_ID,
    surface: CHANNEL_ID,
    originatingChannel: CHANNEL_ID,
    originatingTo: CHANNEL_SENDER,
    deliver: async (payload) => {
      if (!payload.text) return;
      await sendOwnerText({ mcpLink: account.connectionLink, text: payload.text });
    },
    onRecordError: logFailure,
    onDispatchError: logFailure,
  });
}
