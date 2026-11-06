import type { Message } from '@zapbip/core';

export function runConnectorSocket(input: {
  socketLink: string;
  signal: AbortSignal;
  handOff: (input: { message: Message }) => Promise<void>;
}): Promise<number> {
  throw new Error('runConnectorSocket is not implemented');
}
