import { DeliveryState } from '@zapbip/types';
import { SENDING_STALE_MS } from '../claim-constants';
import { QUESTION_RETENTION_MS, RECEIPT_RETENTION_MS } from '../constants';
import { isQueuedMessageExpired } from './flush-queue';
import type { SweepExpiredInput, SweepExpiredResult } from './types';

export async function sweepExpired(input: SweepExpiredInput): Promise<SweepExpiredResult> {
  const { accountId, repository, mediaStore, clock } = input.dependencies;
  const now = clock.now();
  const mediaIds = await repository.listExpiredMediaIds({ now });
  if (mediaIds.length > 0) {
    await mediaStore.delete({ accountId, mediaIds });
    await repository.deleteMedia({ mediaIds });
  }
  await repository.releaseStaleClaims({ claimedBefore: now - SENDING_STALE_MS });
  const queued = await repository.listQueued();
  await Promise.all(
    queued
      .filter((message) => isQueuedMessageExpired({ message, now }))
      .map((message) => repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Expired })),
  );
  await repository.deleteQuestionsAskedBefore({ askedBefore: now - QUESTION_RETENTION_MS });
  await repository.deleteExpiredReceipts({ receivedBefore: now - RECEIPT_RETENTION_MS });
  return { nextDueAt: await repository.findNextExpiry() };
}
