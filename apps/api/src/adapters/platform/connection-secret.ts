import { CONNECTION_SECRET_BYTES, CONNECTION_SECRET_PREFIX } from '../../contract/constants';
import { encodeBase64Url } from './encoding';

export function generateConnectionSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CONNECTION_SECRET_BYTES));
  return `${CONNECTION_SECRET_PREFIX}${encodeBase64Url({ bytes })}`;
}
