import { DeliveryState } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { FLUSH_CLAIM_LIMIT } from '../constants';
import { insertQueued } from '../testing/channel-fixtures';
import { createEnvironment } from '../testing/fixtures';
import { claimQueued } from './claim-queued';

const EXTRA_QUEUED = 3;

describe('claimQueued', () => {
  test('CU-25 claims the oldest queued messages up to the limit and marks them sending', async () => {
    const environment = await createEnvironment();
    const texts = Array.from({ length: FLUSH_CLAIM_LIMIT + EXTRA_QUEUED }, (_unused, index) => `m${index}`);
    const queued = await insertQueued({ environment, texts });
    const claimed = await claimQueued({ dependencies: environment.dependencies });
    expect(claimed.map((message) => message.messageId)).toEqual(queued.slice(0, FLUSH_CLAIM_LIMIT).map((message) => message.messageId));
    expect(claimed.every((message) => message.delivery === DeliveryState.Sending)).toBe(true);
    expect(environment.repository.findClaimedAt({ messageId: claimed[0]!.messageId })).toBe(environment.clock.now());
    expect(await environment.repository.listQueued()).toHaveLength(EXTRA_QUEUED);
  });

  test('a second claim gets only what the first left', async () => {
    const environment = await createEnvironment();
    await insertQueued({ environment, texts: Array.from({ length: FLUSH_CLAIM_LIMIT + EXTRA_QUEUED }, (_unused, index) => `m${index}`) });
    await claimQueued({ dependencies: environment.dependencies });
    expect(await claimQueued({ dependencies: environment.dependencies })).toHaveLength(EXTRA_QUEUED);
    expect(await claimQueued({ dependencies: environment.dependencies })).toEqual([]);
  });
});
