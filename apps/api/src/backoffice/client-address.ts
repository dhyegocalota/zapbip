import { CLIENT_ADDRESS_HEADER } from '../contract/constants';

export function clientAddressOf(input: { request: Request }): string | null {
  const address = input.request.headers.get(CLIENT_ADDRESS_HEADER);
  return address === null ? null : address;
}
