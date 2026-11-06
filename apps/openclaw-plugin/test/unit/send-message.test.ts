import { afterEach, describe, expect, it } from 'vitest';
import { sendOwnerText } from '../../src/send-message';
import {
  FAKE_MCP_SECRET,
  FAKE_MESSAGE_ID,
  startFakeMcpRoute,
  type FakeMcpRoute,
  type FakeMcpRouteOptions,
} from '../support/fake-mcp-route';

const WHATSAPP_TEXT_LIMIT = 4_096;

const stoppers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(stoppers.splice(0).map((stop) => stop()));
});

async function startRoute(input: FakeMcpRouteOptions = {}): Promise<FakeMcpRoute> {
  const route = await startFakeMcpRoute(input);
  stoppers.push(route.stop);
  return route;
}

describe('sendOwnerText', () => {
  it('calls the send_message tool with the text', async () => {
    const route = await startRoute();
    await sendOwnerText({ mcpLink: route.mcpLink, text: 'olá' });
    const call = route.requests().find((entry) => entry.method === 'tools/call');
    expect(call?.params).toEqual({ name: 'send_message', arguments: { text: 'olá' } });
    expect(call?.path).toBe(route.secretPath);
  });

  it('returns the message id the tool reports', async () => {
    const route = await startRoute();
    await expect(sendOwnerText({ mcpLink: route.mcpLink, text: 'oi' })).resolves.toBe(FAKE_MESSAGE_ID);
  });

  it('initializes and announces it before the call', async () => {
    const route = await startRoute();
    await sendOwnerText({ mcpLink: route.mcpLink, text: 'oi' });
    expect(route.methods()).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
  });

  it('makes no request for an empty text', async () => {
    const route = await startRoute();
    await expect(sendOwnerText({ mcpLink: route.mcpLink, text: '' })).resolves.toBeNull();
    expect(route.requests()).toEqual([]);
  });

  it('rejects with the tool message and no secret when the tool fails', async () => {
    const route = await startRoute({ toolError: 'the window is closed' });
    const failure = await sendOwnerText({ mcpLink: route.mcpLink, text: 'oi' }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('the window is closed');
    expect((failure as Error).message).not.toContain('zb_conn_');
  });

  it('rejects after one request when the route answers 401', async () => {
    const route = await startRoute({ status: 401 });
    const failure = await sendOwnerText({ mcpLink: route.mcpLink, text: 'oi' }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('401');
    expect((failure as Error).message).not.toContain(FAKE_MCP_SECRET);
    expect(route.requests()).toHaveLength(1);
  });

  it('rejects once without the link when the connection is refused', async () => {
    const route = await startRoute();
    await route.stop();
    const failure = await sendOwnerText({ mcpLink: route.mcpLink, text: 'oi' }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(FAKE_MCP_SECRET);
    expect((failure as Error).message).not.toContain(route.mcpLink);
  });

  it('sends a text of exactly the limit unchanged', async () => {
    const route = await startRoute({ maxTextLength: WHATSAPP_TEXT_LIMIT });
    const text = 'a'.repeat(WHATSAPP_TEXT_LIMIT);
    await sendOwnerText({ mcpLink: route.mcpLink, text });
    const call = route.requests().find((entry) => entry.method === 'tools/call');
    expect((call?.params.arguments as { text: string }).text).toBe(text);
  });

  it('lets the route reject a text over the limit without truncating it', async () => {
    const route = await startRoute({ maxTextLength: WHATSAPP_TEXT_LIMIT });
    const text = 'a'.repeat(WHATSAPP_TEXT_LIMIT + 1);
    const failure = await sendOwnerText({ mcpLink: route.mcpLink, text }).catch((error: Error) => error);
    expect((failure as Error).message).toContain(`at most ${WHATSAPP_TEXT_LIMIT} characters`);
    const call = route.requests().find((entry) => entry.method === 'tools/call');
    expect((call?.params.arguments as { text: string }).text).toHaveLength(WHATSAPP_TEXT_LIMIT + 1);
  });

  it('keeps a link inside the text as text and calls only the configured route', async () => {
    const route = await startRoute();
    const text = 'see http://evil.example/x';
    await sendOwnerText({ mcpLink: route.mcpLink, text });
    const call = route.requests().find((entry) => entry.method === 'tools/call');
    expect((call?.params.arguments as { text: string }).text).toBe(text);
    expect(route.requests().every((entry) => entry.path === route.secretPath)).toBe(true);
  });
});
