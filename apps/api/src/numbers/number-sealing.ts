export function accessTokenAssociatedData(input: { numberId: string }): string {
  return `whatsapp_numbers:${input.numberId}:access_token`;
}
