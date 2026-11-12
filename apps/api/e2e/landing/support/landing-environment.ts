export enum LandingVariable {
  SiteOrigin = 'ZAPBIP_LANDING_SITE_ORIGIN',
  BackofficeOrigin = 'ZAPBIP_LANDING_BACKOFFICE_ORIGIN',
}

export function landingValue(input: { variable: LandingVariable }): string {
  const value = process.env[input.variable];
  if (value === undefined) throw new Error(`${input.variable} is not set`);
  return value;
}
