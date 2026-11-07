export const HERMES_WHEEL_PATH_PREFIX = '/pkg/';
export const HERMES_WHEEL_FILENAME_PATTERN = /^zapbip_platform-\d+\.\d+\.\d+-py3-none-any\.whl$/;

export function hermesWheelFilename(input: { version: string }): string {
  return `zapbip_platform-${input.version}-py3-none-any.whl`;
}

export function hermesWheelPath(input: { version: string }): string {
  return `${HERMES_WHEEL_PATH_PREFIX}${hermesWheelFilename(input)}`;
}
export const HERMES_REQUIREMENTS_FILENAME_PATTERN = /^zapbip_platform-\d+\.\d+\.\d+-requirements\.txt$/;

export function hermesRequirementsFilename(input: { version: string }): string {
  throw new Error(`hermesRequirementsFilename is not implemented for ${input.version}`);
}

export function hermesRequirementsPath(input: { version: string }): string {
  throw new Error(`hermesRequirementsPath is not implemented for ${input.version}`);
}
