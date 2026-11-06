import type { Clock, WakeDependencies, WakeTransport } from '@zapbip/core';
import { createSqliteWakeRepository } from '../adapters/sqlite/sqlite-wake-repository';
import { createAesGcmWakeSecretBox } from '../adapters/wake/aes-gcm-wake-secret-box';
import { createCloudflareWakeObserver } from '../adapters/wake/wake-observer';
import type { Bindings } from '../contract/env';

export function createWakeDependencies(input: {
  env: Bindings;
  storage: DurableObjectStorage;
  clock: Clock;
  transport: WakeTransport;
}): WakeDependencies {
  const { env, storage, clock, transport } = input;
  return {
    transport,
    secretBox: createAesGcmWakeSecretBox({ base64Key: env.WAKE_SECRET_KEY }),
    repository: createSqliteWakeRepository({ storage, clock }),
    observer: createCloudflareWakeObserver({ dataset: env.WAKE_METRICS }),
  };
}
