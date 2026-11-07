import { createChannelPluginBase, createChatChannelPlugin, type ChannelPlugin } from 'openclaw/plugin-sdk/channel-core';
import type { ChannelAccountSnapshot } from 'openclaw/plugin-sdk/channel-contract';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-contracts';
import type { ZapbipAccount } from './account';
import { CHANNEL_ID, CLEAN_EXIT_CODE, DEFAULT_ACCOUNT_ID, DELIVERY_MODE_DIRECT, REPLACED_EXIT_CODE } from './constants';
import { deriveSocketLink } from './connection-link';
import { runConnectorSocket } from './connector-socket';
import { handOffToAgent } from './handoff';
import { sendOwnerText } from './send-message';

type StartContext = { cfg: OpenClawConfig; abortSignal: AbortSignal; setStatus: (next: ChannelAccountSnapshot) => void };
type SendTextContext = { cfg: OpenClawConfig; text: string };

const MISSING_LINK_MESSAGE = `channels.${CHANNEL_ID}.connectionLink is required`;
const REPLACED_MESSAGE = 'a newer listener replaced this one';
const NOTHING_SENT_MESSAGE = 'there was no text to send to the owner';

function connectionLinkOf(input: { cfg: OpenClawConfig }): string | undefined {
  const section = (input.cfg.channels as Record<string, { connectionLink?: string }> | undefined)?.[CHANNEL_ID];
  return section?.connectionLink;
}

function resolveAccount(cfg: OpenClawConfig): ZapbipAccount {
  const connectionLink = connectionLinkOf({ cfg });
  if (connectionLink === undefined) throw new Error(MISSING_LINK_MESSAGE);
  return { accountId: DEFAULT_ACCOUNT_ID, connectionLink };
}

async function startAccount({ cfg, abortSignal, setStatus }: StartContext): Promise<void> {
  const account = resolveAccount(cfg);
  const socketLink = deriveSocketLink({ connectionLink: account.connectionLink });
  const exitCode = await runConnectorSocket({
    socketLink,
    signal: abortSignal,
    handOff: ({ message }) => handOffToAgent({ cfg, account, message }),
  });
  if (exitCode === REPLACED_EXIT_CODE)
    return setStatus({ accountId: account.accountId, lifecycle: 'blocked', terminalDisconnect: true, lastError: REPLACED_MESSAGE });
  if (exitCode !== CLEAN_EXIT_CODE) throw new Error(`the zapbip connector stopped with exit code ${exitCode}`);
}

async function sendText({ cfg, text }: SendTextContext): Promise<{ messageId: string }> {
  const messageId = await sendOwnerText({ mcpLink: resolveAccount(cfg).connectionLink, text });
  if (messageId === null) throw new Error(NOTHING_SENT_MESSAGE);
  return { messageId };
}

export function createZapbipPlugin(): ChannelPlugin<ZapbipAccount> {
  const plugin = createChatChannelPlugin<ZapbipAccount>({
    base: {
      ...createChannelPluginBase<ZapbipAccount>({ id: CHANNEL_ID, setup: { applyAccountConfig: ({ cfg }) => cfg } }),
      config: {
        listAccountIds: () => [DEFAULT_ACCOUNT_ID],
        resolveAccount,
        inspectAccount(cfg) {
          const isConfigured = connectionLinkOf({ cfg }) !== undefined;
          return { enabled: isConfigured, configured: isConfigured };
        },
      },
    },
    outbound: {
      base: { deliveryMode: DELIVERY_MODE_DIRECT },
      attachedResults: { channel: CHANNEL_ID, sendText },
    },
  });
  return { ...plugin, gateway: { startAccount } };
}
