import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const LOOPBACK_HOST = '127.0.0.1';
const MESSAGING_PRODUCT = 'whatsapp';
const MESSAGE_ID_PREFIX = 'wamid.fake-';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const OK_STATUS = 200;

export type RecordedSend = { path: string; body: unknown };

export type FakeGraph = { baseUrl: string; sends: RecordedSend[]; close(): Promise<void> };

export function startFakeGraph(): Promise<FakeGraph> {
  const sends: RecordedSend[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      sends.push({ path: request.url as string, body: JSON.parse(Buffer.concat(chunks).toString()) });
      response.writeHead(OK_STATUS, JSON_HEADERS);
      response.end(JSON.stringify({ messaging_product: MESSAGING_PRODUCT, messages: [{ id: `${MESSAGE_ID_PREFIX}${sends.length}` }] }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://${LOOPBACK_HOST}:${port}`,
        sends,
        close: () => new Promise((closed) => server.close(() => closed())),
      });
    });
  });
}
