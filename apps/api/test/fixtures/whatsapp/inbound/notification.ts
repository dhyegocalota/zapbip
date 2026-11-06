import { WebhookField } from '../../../../src/adapters/whatsapp/inbound-parser';

export const OUR_PHONE_NUMBER_ID = '1000000000000001';
export const FOREIGN_PHONE_NUMBER_ID = '2000000000000002';
export const OWNER_WA_ID = '5511900000001';

const DISPLAY_PHONE_NUMBER = '15550000000';
const MESSAGING_PRODUCT = 'whatsapp';
const WHATSAPP_OBJECT = 'whatsapp_business_account';

type ChangeInput = {
  field?: string;
  phoneNumberId?: string | null;
  messages?: object[];
  statuses?: object[];
};

export function changeOf(input: ChangeInput): object {
  const { field = WebhookField.Messages, phoneNumberId = OUR_PHONE_NUMBER_ID, messages = [], statuses = [] } = input;
  const metadata =
    phoneNumberId === null ? {} : { metadata: { display_phone_number: DISPLAY_PHONE_NUMBER, phone_number_id: phoneNumberId } };
  return { field, value: { messaging_product: MESSAGING_PRODUCT, ...metadata, messages, statuses } };
}

export function notificationOf(input: { changes: object[] }): object {
  return { object: WHATSAPP_OBJECT, entry: [{ id: '3000000000000003', changes: input.changes }] };
}

export function notificationWith(input: { messages?: object[]; statuses?: object[] }): object {
  return notificationOf({ changes: [changeOf(input)] });
}
