import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { connect } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ANY_HOST, CONTAINER_HOST, LOOPBACK_HOST } from './constants';
import { freePort } from './free-port';

const runCommand = promisify(execFile);
const CERTIFICATE_FILE = 'front-cert.pem';
const KEY_FILE = 'front-key.pem';
const CERTIFICATE_DAYS = '1';
const KEY_ALGORITHM = 'rsa:2048';
const BAD_GATEWAY_STATUS = 502;
const UPGRADE_REJECTED_STATUS_LINE = 'HTTP/1.1 502 Bad Gateway\r\n\r\n';

export type TlsFront = { port: number; certificateFile: string; close: () => Promise<void> };

async function generateCertificate(input: { directory: string }): Promise<{ certificateFile: string; keyFile: string }> {
  const certificateFile = join(input.directory, CERTIFICATE_FILE);
  const keyFile = join(input.directory, KEY_FILE);
  await runCommand('openssl', [
    'req',
    '-x509',
    '-newkey',
    KEY_ALGORITHM,
    '-nodes',
    '-keyout',
    keyFile,
    '-out',
    certificateFile,
    '-days',
    CERTIFICATE_DAYS,
    '-subj',
    `/CN=${CONTAINER_HOST}`,
    '-addext',
    `subjectAltName=DNS:${CONTAINER_HOST},DNS:localhost,IP:${LOOPBACK_HOST}`,
  ]);
  return { certificateFile, keyFile };
}

export async function startTlsFront(input: { targetPort: number; directory: string }): Promise<TlsFront> {
  const { certificateFile, keyFile } = await generateCertificate({ directory: input.directory });
  const port = await freePort();
  const server = createHttpsServer({ cert: await readFile(certificateFile), key: await readFile(keyFile) }, (incoming, outgoing) => {
    const forwarded = httpRequest(
      { host: LOOPBACK_HOST, port: input.targetPort, method: incoming.method, path: incoming.url, headers: incoming.headers },
      (answer) => {
        outgoing.writeHead(answer.statusCode as number, answer.headers);
        answer.pipe(outgoing);
      },
    );
    forwarded.on('error', () => outgoing.writeHead(BAD_GATEWAY_STATUS).end());
    incoming.pipe(forwarded);
  });
  server.on('upgrade', (incoming, clientSocket, head) => {
    const upstream = connect(input.targetPort, LOOPBACK_HOST, () => {
      const headerLines = Object.entries(incoming.headers).map(([name, value]) => `${name}: ${value}`);
      upstream.write(`${incoming.method} ${incoming.url} HTTP/1.1\r\n${headerLines.join('\r\n')}\r\n\r\n`);
      upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on('error', () => clientSocket.end(UPGRADE_REJECTED_STATUS_LINE));
    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
    upstream.on('close', () => clientSocket.destroy());
  });
  await new Promise<void>((resolve) => server.listen(port, ANY_HOST, resolve));
  return {
    port,
    certificateFile,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
