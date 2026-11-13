export enum ClientAppVariable {
  AppOrigin = 'ZAPBIP_CLIENT_APP_ORIGIN',
  PublicOrigin = 'ZAPBIP_CLIENT_APP_PUBLIC_ORIGIN',
  ScreenshotDirectory = 'ZAPBIP_CLIENT_APP_SCREENSHOTS',
}

export function clientAppValue(input: { variable: ClientAppVariable }): string {
  const value = process.env[input.variable];
  if (value === undefined) throw new Error(`${input.variable} is not set`);
  return value;
}
