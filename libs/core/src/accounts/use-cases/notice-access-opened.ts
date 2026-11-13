import type { DeliveryState } from '@zapbip/types';
import type { CoreDependencies } from '../../inbox/ports';
import type { OwnerAccountContext } from '../account-types';

export type NoticeAccessOpenedInput = {
  dependencies: CoreDependencies;
  account: OwnerAccountContext;
  appOrigin: string;
};

export async function noticeAccessOpened(input: NoticeAccessOpenedInput): Promise<DeliveryState.Sent | DeliveryState.Queued> {
  throw new Error('noticeAccessOpened is not implemented');
}
