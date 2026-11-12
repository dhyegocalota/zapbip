export function createPendingSignIn(input: { database: D1Database; now: number }): Promise<string> {
  throw new Error('createPendingSignIn is not implemented');
}

export function consumePendingSignIn(input: { database: D1Database; token: string; now: number }): Promise<boolean> {
  throw new Error('consumePendingSignIn is not implemented');
}

export function isPendingSignInLive(input: { database: D1Database; token: string; now: number }): Promise<boolean> {
  throw new Error('isPendingSignInLive is not implemented');
}
