import { createServer } from 'node:net';
import { ANY_HOST } from './constants';

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, ANY_HOST, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') return reject(new Error('no port assigned'));
      server.close(() => resolve(address.port));
    });
  });
}
