import type { ServerFrame } from '@zapbip/core';
import type { ConnectorClient, FrameRejectionReason } from '@zapbip/types';

export type ServerFrameParse = { ok: true; frame: ServerFrame } | { ok: false; reason: FrameRejectionReason };

export function deriveConnectorLinks(input: { connectionLink: string }): { probeLink: string; socketLink: string } {
  void input;
  throw new Error('deriveConnectorLinks is not implemented');
}

export function reconnectDelayMs(input: { attempt: number }): number {
  void input;
  throw new Error('reconnectDelayMs is not implemented');
}

export async function probeConnectorLink(input: { probeLink: string }): Promise<number> {
  void input;
  throw new Error('probeConnectorLink is not implemented');
}

export function parseServerFrame(input: { text: string; byteLength: number }): ServerFrameParse {
  void input;
  throw new Error('parseServerFrame is not implemented');
}

export async function runConnection(input: {
  socketLink: string;
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
  signal: AbortSignal;
}): Promise<number> {
  void input;
  throw new Error('runConnection is not implemented');
}
