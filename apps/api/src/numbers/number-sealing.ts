export function accessTokenAssociatedData(input: { numberId: string }): string {
  return `whatsapp_numbers:${input.numberId}:access_token`;
}

export function twoStepPinAssociatedData(input: { numberId: string }): string {
  return `whatsapp_numbers:${input.numberId}:two_step_pin`;
}
