export const HERMES_WHEEL_PATH_PREFIX = '/pkg/';

export function hermesWheelFilename(input: { version: string }): string {
  throw new Error(`hermesWheelFilename is not implemented for ${input.version}`);
}

export function hermesWheelPath(input: { version: string }): string {
  throw new Error(`hermesWheelPath is not implemented for ${input.version}`);
}
