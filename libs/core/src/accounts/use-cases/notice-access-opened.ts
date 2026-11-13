import { AccountReplyIntent, AccountReplyParameter, IdPrefix, MessageKind, type DeliveryState } from '@zapbip/types';
import { deliverToOwner } from '../../inbox/use-cases/deliver-to-owner';
import type { CoreDependencies } from '../../inbox/ports';
import { renderAccountReply } from '../account-copy';
import type { OwnerAccountContext } from '../account-types';
import { buildAppLink } from '../app-link';
import { buildTextReply } from './account-reply';

export type NoticeAccessOpenedInput = {
  dependencies: CoreDependencies;
  account: OwnerAccountContext;
  appOrigin: string;
};

export async function noticeAccessOpened(input: NoticeAccessOpenedInput): Promise<DeliveryState.Sent | DeliveryState.Queued> {
  const { dependencies, account, appOrigin } = input;
  const { locale } = account;
  const parameters = { [AccountReplyParameter.AppLink]: buildAppLink({ appOrigin, locale }) };
  const reply = buildTextReply({ intent: AccountReplyIntent.AccessOpened, locale, parameters });
  const { delivery } = await deliverToOwner({
    dependencies,
    ownerLocale: locale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text: renderAccountReply({ reply }) },
    replyToMessageId: null,
  });
  return delivery;
}
