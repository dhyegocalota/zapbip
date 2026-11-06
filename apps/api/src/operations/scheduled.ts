import type { Bindings } from '../contract/env';

export async function runScheduled(input: { cron: string; now: number; env: Bindings }): Promise<void> {
  throw new Error(`runScheduled is not implemented for ${input.cron}`);
}
