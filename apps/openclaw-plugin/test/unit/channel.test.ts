import { readFileSync } from 'node:fs';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import entry from '../../index';
import { createZapbipPlugin } from '../../src/channel';
import { runConnectorSocket } from '../../src/connector-socket';
import { handOffToAgent } from '../../src/handoff';
import { sendOwnerText } from '../../src/send-message';
import { ownerTextMessage } from '../support/fake-connector';

vi.mock('../../src/connector-socket', () => ({ runConnectorSocket: vi.fn(() => Promise.resolve(0)) }));
vi.mock('../../src/handoff', () => ({ handOffToAgent: vi.fn(() => Promise.resolve()) }));
vi.mock('../../src/send-message', () => ({ sendOwnerText: vi.fn(() => Promise.resolve('wamid.1')) }));

const CONNECTION_LINK = 'https://zapbip.example/c/abc123/mcp';
const SOCKET_LINK = 'wss://zapbip.example/c/abc123/connector';
const MANIFEST = JSON.parse(readFileSync(new URL('../../openclaw.plugin.json', import.meta.url), 'utf8')) as {
  id: string;
  channels: string[];
  channelConfigs: { zapbip: { schema: { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean } } };
};

function configWith(input: { channels?: Record<string, unknown> }): OpenClawConfig {
  return input as unknown as OpenClawConfig;
}

function startContext(input: { cfg: OpenClawConfig; signal?: AbortSignal }) {
  return { cfg: input.cfg, accountId: 'default', abortSignal: input.signal ?? new AbortController().signal } as never;
}

function plugin() {
  const created = createZapbipPlugin();
  const startAccount = created.gateway?.startAccount as (context: never) => Promise<unknown>;
  return { created, startAccount };
}

beforeEach(() => {
  vi.mocked(runConnectorSocket).mockReset().mockResolvedValue(0);
  vi.mocked(handOffToAgent).mockClear();
  vi.mocked(sendOwnerText).mockClear();
});

describe('manifest and entry', () => {
  it('declares the zapbip channel', () => {
    expect(MANIFEST.id).toBe('zapbip');
    expect(MANIFEST.channels).toEqual(['zapbip']);
  });

  it('asks the channel config for the connection link and nothing else', () => {
    const { schema } = MANIFEST.channelConfigs.zapbip;
    expect(schema.required).toEqual(['connectionLink']);
    expect(Object.keys(schema.properties)).toEqual(['connectionLink']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('exports an entry for the zapbip channel plugin', () => {
    expect(entry.id).toBe('zapbip');
    expect(entry.channelPlugin.id).toBe('zapbip');
  });
});

describe('config', () => {
  it('resolves the default account from the connection link', () => {
    const { created } = plugin();
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    expect(created.config.listAccountIds(cfg)).toEqual(['default']);
    expect(created.config.resolveAccount(cfg, 'default')).toEqual({ accountId: 'default', connectionLink: CONNECTION_LINK });
  });

  it('throws a message naming connectionLink when the link is missing', () => {
    const { created } = plugin();
    expect(() => created.config.resolveAccount(configWith({ channels: { zapbip: {} } }), 'default')).toThrow(/connectionLink/);
  });

  it('inspects an unconfigured channel without throwing', () => {
    const { created } = plugin();
    expect(created.config.inspectAccount?.(configWith({}), 'default')).toEqual({ enabled: false, configured: false });
  });

  it('inspects a configured channel as configured', () => {
    const { created } = plugin();
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    expect(created.config.inspectAccount?.(cfg, 'default')).toEqual({ enabled: true, configured: true });
  });
});

describe('startAccount', () => {
  it('opens the connector socket on the derived link with the abort signal', async () => {
    const { startAccount } = plugin();
    const controller = new AbortController();
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    await startAccount(startContext({ cfg, signal: controller.signal }));
    const call = vi.mocked(runConnectorSocket).mock.calls[0]?.[0];
    expect(call?.socketLink).toBe(SOCKET_LINK);
    expect(call?.signal).toBe(controller.signal);
  });

  it('hands each message to the agent of the configured account', async () => {
    const { startAccount } = plugin();
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    await startAccount(startContext({ cfg }));
    const message = ownerTextMessage({ messageId: 'msg_1', text: 'oi' });
    await vi.mocked(runConnectorSocket).mock.calls[0]?.[0].handOff({ message });
    expect(handOffToAgent).toHaveBeenCalledWith({ cfg, account: { accountId: 'default', connectionLink: CONNECTION_LINK }, message });
  });

  it('resolves once the socket stops after an abort', async () => {
    const { startAccount } = plugin();
    const controller = new AbortController();
    vi.mocked(runConnectorSocket).mockImplementation(
      ({ signal }) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(0), { once: true })),
    );
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    const running = startAccount(startContext({ cfg, signal: controller.signal }));
    controller.abort();
    await expect(running).resolves.toBeUndefined();
  });

  it('throws without opening a socket when the link is missing', async () => {
    const { startAccount } = plugin();
    await expect(startAccount(startContext({ cfg: configWith({ channels: { zapbip: {} } }) }))).rejects.toThrow(/connectionLink/);
    expect(runConnectorSocket).not.toHaveBeenCalled();
  });

  it('refuses an http link, names https and opens no socket', async () => {
    const { startAccount } = plugin();
    const cfg = configWith({ channels: { zapbip: { connectionLink: 'http://zapbip.example/c/abc123/mcp' } } });
    await expect(startAccount(startContext({ cfg }))).rejects.toThrow(/https/);
    expect(runConnectorSocket).not.toHaveBeenCalled();
  });

  it('throws when the socket stops with a failure exit code', async () => {
    const { startAccount } = plugin();
    vi.mocked(runConnectorSocket).mockResolvedValue(1);
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    const failure = await startAccount(startContext({ cfg })).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain('abc123');
  });
});

describe('outbound', () => {
  function sendText(input: { text: string }) {
    const { created } = plugin();
    const cfg = configWith({ channels: { zapbip: { connectionLink: CONNECTION_LINK } } });
    const send = created.outbound?.sendText as (context: never) => Promise<{ messageId: string; channel: string }>;
    return send({ cfg, text: input.text, accountId: 'default', to: 'owner' } as never);
  }

  it('sends the text to the owner through the connection link and reports the message id', async () => {
    await expect(sendText({ text: 'olá' })).resolves.toMatchObject({ channel: 'zapbip', messageId: 'wamid.1' });
    expect(sendOwnerText).toHaveBeenCalledWith({ mcpLink: CONNECTION_LINK, text: 'olá' });
  });

  it('throws when nothing was sent', async () => {
    vi.mocked(sendOwnerText).mockResolvedValueOnce(null);
    await expect(sendText({ text: '' })).rejects.toThrow();
  });
});
