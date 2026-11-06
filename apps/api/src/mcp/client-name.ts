import type { ConnectionRecord } from '@zapbip/core';

export type ConnectionRecorders = {
  recordClientName(input: { connectionId: string; clientName: string }): Promise<void>;
  recordFirstCall(input: { connectionId: string; calledAt: number }): Promise<void>;
};

export type ConnectionActivityInput = {
  request: Request;
  connection: Pick<ConnectionRecord, 'connectionId' | 'clientName' | 'firstCallAt'>;
  recorders: ConnectionRecorders;
  calledAt: number;
  schedule: (work: Promise<void>) => void;
};

export function readInitializeClientName(input: { requestText: string }): string | null {
  void input;
  throw new Error('readInitializeClientName is not implemented');
}

export function recordConnectionActivity(input: ConnectionActivityInput): void {
  void input;
  throw new Error('recordConnectionActivity is not implemented');
}
