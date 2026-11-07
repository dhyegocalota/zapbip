import type { ServerFrame } from '@zapbip/core';
import { SELF } from 'cloudflare:test';

const ORIGIN = 'http://example.com';
const UPGRADE_HEADERS = { Upgrade: 'websocket' };

export type ConnectorSession = {
  socket: WebSocket;
  nextFrame(): Promise<ServerFrame>;
  receivedCount(): number;
  closeCode(): Promise<number>;
};

export function connectorUrl(input: { secret: string; query?: string }): string {
  const query = input.query === undefined ? '' : input.query;
  return `${ORIGIN}/c/${input.secret}/connector${query}`;
}

export async function openConnector(input: { secret: string; query?: string }): Promise<ConnectorSession> {
  const response = await SELF.fetch(connectorUrl(input), { headers: UPGRADE_HEADERS });
  const { webSocket: socket } = response;
  if (socket === null) throw new Error(`connector upgrade answered ${response.status}`);
  const received: ServerFrame[] = [];
  const waiting: Array<(frame: ServerFrame) => void> = [];
  const closed = new Promise<number>((resolve) => socket.addEventListener('close', (event) => resolve(event.code)));
  socket.addEventListener('message', (event) => {
    const frame = JSON.parse(String(event.data)) as ServerFrame;
    const resolveNext = waiting.shift();
    if (resolveNext === undefined) return void received.push(frame);
    resolveNext(frame);
  });
  socket.accept();
  return {
    socket,
    nextFrame: () => {
      const frame = received.shift();
      if (frame !== undefined) return Promise.resolve(frame);
      return new Promise<ServerFrame>((resolve) => waiting.push(resolve));
    },
    receivedCount: () => received.length,
    closeCode: () => closed,
  };
}
