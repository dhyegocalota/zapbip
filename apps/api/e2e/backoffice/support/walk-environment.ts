export enum WalkVariable {
  Origin = 'ZAPBIP_WALK_ORIGIN',
  PersistDirectory = 'ZAPBIP_WALK_PERSIST_DIRECTORY',
  GraphBaseUrl = 'ZAPBIP_WALK_GRAPH_BASE_URL',
  ScreenshotDirectory = 'ZAPBIP_WALK_SCREENSHOTS',
}

export function walkValue(input: { variable: WalkVariable }): string {
  const value = process.env[input.variable];
  if (value === undefined) throw new Error(`${input.variable} is not set`);
  return value;
}
