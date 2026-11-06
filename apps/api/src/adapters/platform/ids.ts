import type { IdGenerator } from '@zapbip/core';

export function createIdGenerator(): IdGenerator {
  return { next: ({ prefix }) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}` };
}
