import type { SignInLinks } from '@zapbip/core';

export class D1SignInLinks implements SignInLinks {
  constructor(_input: { database: D1Database }) {}

  issue(): Promise<string> {
    throw new Error('D1SignInLinks is not implemented');
  }
}
