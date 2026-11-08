export function accessTokenAssociatedData(input: { numberId: string }): string {
  return `whatsapp_numbers:${input.numberId}:access_token`;
}

export function appSecretAssociatedData(input: { metaAppRef: string }): string {
  return `meta_apps:${input.metaAppRef}:app_secret`;
}
