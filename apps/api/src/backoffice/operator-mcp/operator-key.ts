export type OperatorKeyMaterial = { keyId: string; key: string };

export function createOperatorKey(input: { idBytes: Uint8Array; secretBytes: Uint8Array }): OperatorKeyMaterial {
  throw new Error('createOperatorKey is not implemented');
}

export function parseOperatorKey(input: { key: string }): { keyId: string } | null {
  throw new Error('parseOperatorKey is not implemented');
}

export function hashOperatorKey(input: { key: string }): Promise<string> {
  throw new Error('hashOperatorKey is not implemented');
}

export function isOperatorKeyLive(input: { expiresAt: number; revokedAt: number | null; now: number }): boolean {
  throw new Error('isOperatorKeyLive is not implemented');
}

export function parseKeyLifetimeDays(input: { value: string }): number | null {
  throw new Error('parseKeyLifetimeDays is not implemented');
}
