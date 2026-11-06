import type { Message } from '@zapbip/core';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from '@zapbip/types';
import { logConnectorEvent, type ConnectorLogger } from './log';

export function reconnectDelayMs(input: { attempt: number }): number {
  throw new Error('reconnectDelayMs is not implemented');
}

export function runConnectorSocket(input: {
  socketLink: string;
  signal: AbortSignal;
  handOff: (input: { message: Message }) => Promise<void>;
  log?: ConnectorLogger;
  wait?: (input: { delayMs: number; signal: AbortSignal }) => Promise<void>;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}): Promise<number> {
  throw new Error('runConnectorSocket is not implemented');
}
