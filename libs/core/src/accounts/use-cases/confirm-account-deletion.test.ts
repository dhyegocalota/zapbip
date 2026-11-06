import { AccountReplyIntent, AccountReplyParameter } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { DELETION_CONFIRM_TTL_MS } from '../constants';
import { createAccountFixture, intentsOf, ownerInputOf } from '../testing/fixtures';
import { confirmAccountDeletion } from './confirm-account-deletion';
import { requestAccountDeletion } from './request-account-deletion';

describe('requestAccountDeletion', () => {
  test('stores the request time and replies with the phrase', async () => {
    const fixture = await createAccountFixture();
    const result = await requestAccountDeletion(ownerInputOf(fixture));
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.DeletionRequest]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.Phrase]).toBe('apagar conta definitivamente');
    expect(await fixture.environment.dependencies.deletionRequests.find()).toBe(fixture.environment.clock.now());
    expect(result.deletionConfirmed).toBe(false);
  });
});

describe('confirmAccountDeletion', () => {
  test('without a request it replies expired', async () => {
    const fixture = await createAccountFixture();
    const result = await confirmAccountDeletion({ ...ownerInputOf(fixture), isRequestLive: false });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.DeletionExpired]);
    expect(result.deletionConfirmed).toBe(false);
  });

  test('inside the time to live it confirms and replies done', async () => {
    const fixture = await createAccountFixture();
    await requestAccountDeletion(ownerInputOf(fixture));
    await fixture.environment.clock.advance({ ms: DELETION_CONFIRM_TTL_MS });
    const result = await confirmAccountDeletion({ ...ownerInputOf(fixture), isRequestLive: true });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.DeletionDone]);
    expect(result.deletionConfirmed).toBe(true);
  });

  test('one millisecond past the time to live it refuses and clears the request', async () => {
    const fixture = await createAccountFixture();
    await requestAccountDeletion(ownerInputOf(fixture));
    await fixture.environment.clock.advance({ ms: DELETION_CONFIRM_TTL_MS + 1 });
    const result = await confirmAccountDeletion({ ...ownerInputOf(fixture), isRequestLive: false });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.DeletionExpired]);
    expect(result.deletionConfirmed).toBe(false);
    expect(await fixture.environment.dependencies.deletionRequests.find()).toBeNull();
  });
});
