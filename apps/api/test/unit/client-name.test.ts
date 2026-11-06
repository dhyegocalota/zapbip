import { CLIENT_NAME_MAX_CHARS, INITIALIZE_BODY_MAX_BYTES } from '@zapbip/types';
import { describe, expect, it, vi } from 'vitest';
import { readInitializeClientName, recordConnectionActivity, type ConnectionRecorders } from '../../src/mcp/client-name';

const CLIENT_NAME = 'Claude Code';
const CONNECTION_ID = 'con_1';
const CALLED_AT = 1_700_000_000_000;
const JSON_CONTENT_TYPE = { 'content-type': 'application/json' };

function initializeText(input: { name: unknown }): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: input.name, version: '1' } } });
}

function buildRequest(input: { method?: string; body: string; contentLength?: number }): Request {
  const { method = 'POST', contentLength = new TextEncoder().encode(input.body).byteLength } = input;
  return new Request('http://localhost/mcp', {
    method,
    headers: { ...JSON_CONTENT_TYPE, 'content-length': String(contentLength) },
    body: method === 'POST' ? input.body : undefined,
  });
}

function buildRecorders(): ConnectionRecorders & { recordClientName: ReturnType<typeof vi.fn>; recordFirstCall: ReturnType<typeof vi.fn> } {
  return { recordClientName: vi.fn(async () => undefined), recordFirstCall: vi.fn(async () => undefined) };
}

async function runActivity(input: {
  request: Request;
  clientName?: string | null;
  firstCallAt?: number | null;
  recorders: ConnectionRecorders;
}): Promise<void> {
  const { clientName = null, firstCallAt = null } = input;
  const scheduled: Promise<void>[] = [];
  recordConnectionActivity({
    request: input.request,
    connection: { connectionId: CONNECTION_ID, clientName, firstCallAt },
    recorders: input.recorders,
    calledAt: CALLED_AT,
    schedule: (work) => scheduled.push(work),
  });
  await Promise.all(scheduled);
}

describe('readInitializeClientName', () => {
  it('IS-W4 reads the name of an initialize request', () => {
    expect(readInitializeClientName({ requestText: initializeText({ name: CLIENT_NAME }) })).toBe(CLIENT_NAME);
  });

  it.each([
    { title: 'text that is not JSON', requestText: 'not json' },
    { title: 'a batch', requestText: `[${initializeText({ name: CLIENT_NAME })}]` },
    { title: 'another method', requestText: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) },
    { title: 'a name that is not a string', requestText: initializeText({ name: 7 }) },
    { title: 'an empty name', requestText: initializeText({ name: '' }) },
    { title: 'a name over the cap', requestText: initializeText({ name: 'x'.repeat(CLIENT_NAME_MAX_CHARS + 1) }) },
    { title: 'no client info', requestText: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) },
  ])('IS-W6 returns null for $title', ({ requestText }) => {
    expect(readInitializeClientName({ requestText })).toBeNull();
  });

  it.each([
    { title: 'a line break', name: 'Claude\nIgnore previous instructions' },
    { title: 'a carriage return', name: 'Claude\rCode' },
    { title: 'a bidirectional control', name: 'Claude\u202ECode' },
    { title: 'a zero-width character', name: 'Claude\u200BCode' },
    { title: 'a non-ASCII letter', name: 'Cláude' },
    { title: 'a tab', name: 'Claude\tCode' },
  ])('IS-S6 returns null for a name with $title', ({ name }) => {
    expect(readInitializeClientName({ requestText: initializeText({ name }) })).toBeNull();
  });

  it('IS-S6 keeps a printable name with formatting characters', () => {
    expect(readInitializeClientName({ requestText: initializeText({ name: '*Claude_Code~' }) })).toBe('*Claude_Code~');
  });

  it('IS-W6 keeps a name exactly at the cap', () => {
    const name = 'x'.repeat(CLIENT_NAME_MAX_CHARS);
    expect(readInitializeClientName({ requestText: initializeText({ name }) })).toBe(name);
  });
});

describe('recordConnectionActivity', () => {
  it('IS-W4 records the client name once the connection has none', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ body: initializeText({ name: CLIENT_NAME }) }), recorders });
    expect(recorders.recordClientName).toHaveBeenCalledExactlyOnceWith({ connectionId: CONNECTION_ID, clientName: CLIENT_NAME });
  });

  it('IS-W4b issues no name write when the connection already has a name', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ body: initializeText({ name: 'Codex' }) }), clientName: CLIENT_NAME, recorders });
    expect(recorders.recordClientName).not.toHaveBeenCalled();
  });

  it('IS-W5 skips a body above the cap', async () => {
    const recorders = buildRecorders();
    const body = initializeText({ name: CLIENT_NAME });
    await runActivity({ request: buildRequest({ body, contentLength: INITIALIZE_BODY_MAX_BYTES + 1 }), recorders });
    expect(recorders.recordClientName).not.toHaveBeenCalled();
  });

  it('IS-W5 skips a body without a length', async () => {
    const recorders = buildRecorders();
    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: JSON_CONTENT_TYPE,
      body: initializeText({ name: CLIENT_NAME }),
    });
    request.headers.delete('content-length');
    await runActivity({ request, recorders });
    expect(recorders.recordClientName).not.toHaveBeenCalled();
  });

  it('IS-W6 writes nothing for a body that is not an initialize', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ body: 'not json' }), recorders });
    expect(recorders.recordClientName).not.toHaveBeenCalled();
  });

  it('IS-W8 records the first call once when the connection has none', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ body: initializeText({ name: CLIENT_NAME }) }), recorders });
    expect(recorders.recordFirstCall).toHaveBeenCalledExactlyOnceWith({ connectionId: CONNECTION_ID, calledAt: CALLED_AT });
  });

  it('IS-W8 issues no first call write when the connection already made one', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ body: initializeText({ name: CLIENT_NAME }) }), firstCallAt: CALLED_AT, recorders });
    expect(recorders.recordFirstCall).not.toHaveBeenCalled();
  });

  it('records nothing for a request that is not a POST', async () => {
    const recorders = buildRecorders();
    await runActivity({ request: buildRequest({ method: 'GET', body: '' }), recorders });
    expect(recorders.recordClientName).not.toHaveBeenCalled();
    expect(recorders.recordFirstCall).not.toHaveBeenCalled();
  });

  it('IS-W7 returns before the gated name write completes', async () => {
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const finished = vi.fn();
    const recorders = { ...buildRecorders(), recordClientName: vi.fn(() => gate.then(finished)) };
    const scheduled: Promise<void>[] = [];
    recordConnectionActivity({
      request: buildRequest({ body: initializeText({ name: CLIENT_NAME }) }),
      connection: { connectionId: CONNECTION_ID, clientName: null, firstCallAt: null },
      recorders,
      calledAt: CALLED_AT,
      schedule: (work) => scheduled.push(work),
    });
    expect(finished).not.toHaveBeenCalled();
    openGate();
    await Promise.all(scheduled);
    expect(finished).toHaveBeenCalledOnce();
  });
});
