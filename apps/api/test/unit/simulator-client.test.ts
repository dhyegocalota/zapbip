import { MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import type { SmokeFetch } from '../../src/operations/smoke-checks';
import { mcpSecretOf, postOwnerText, readOwnerScreen } from '../../src/operations/simulator-client';

const ORIGIN = 'http://127.0.0.1:8787';
const PHONE = '5511999990000';
const SECRET = `zb_conn_${'a'.repeat(43)}`;

type Seen = { url: string; method: string; body: string };

function recordingFetch(input: { response: Response }): { fetchRequest: SmokeFetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const fetchRequest: SmokeFetch = async (target, init) => {
    seen.push({ url: String(target), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : '' });
    return input.response.clone();
  };
  return { fetchRequest, seen };
}

function entry(input: { text: string }): ScreenEntry {
  return { at: 1, messageId: null, template: null, text: input.text, options: [] };
}

describe('simulator client', () => {
  it('posts a text message to the owner endpoint of the phone', async () => {
    const { fetchRequest, seen } = recordingFetch({ response: Response.json({ message_id: 'm1' }) });
    await postOwnerText({ origin: ORIGIN, phone: PHONE, fetchRequest, text: 'novo agente smoke' });
    expect(seen).toEqual([
      {
        url: `${ORIGIN}/dev/owner/${PHONE}/messages`,
        method: 'POST',
        body: JSON.stringify({ kind: MessageKind.Text, text: 'novo agente smoke' }),
      },
    ]);
  });

  it('throws naming the status when the simulator refuses', async () => {
    const { fetchRequest } = recordingFetch({ response: new Response('no', { status: 404 }) });
    await expect(postOwnerText({ origin: ORIGIN, phone: PHONE, fetchRequest, text: 'x' })).rejects.toThrow('404');
  });

  it('reads the screen entries of the phone', async () => {
    const entries = [entry({ text: 'hello' })];
    const { fetchRequest, seen } = recordingFetch({ response: Response.json({ entries }) });
    expect(await readOwnerScreen({ origin: ORIGIN, phone: PHONE, fetchRequest })).toEqual(entries);
    expect(seen[0]?.url).toBe(`${ORIGIN}/dev/owner/${PHONE}/screen`);
  });

  it('extracts the connection secret from the mcp url on the screen', () => {
    const entries = [entry({ text: 'welcome' }), entry({ text: `Add ${ORIGIN}/c/${SECRET}/mcp to your agent` })];
    expect(mcpSecretOf({ entries })).toBe(SECRET);
  });

  it('throws when no entry carries an mcp url', () => {
    expect(() => mcpSecretOf({ entries: [entry({ text: 'welcome' })] })).toThrow('mcp url');
  });
});
