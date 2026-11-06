import type { Clock, WakeDependencies, WakeTransport } from '@zapbip/core';
import type { Bindings } from '../contract/env';

export function createWakeDependencies(input: {
  env: Bindings;
  storage: DurableObjectStorage;
  clock: Clock;
  transport: WakeTransport;
}): WakeDependencies {
  void input;
  throw new Error('createWakeDependencies is not implemented');
}
