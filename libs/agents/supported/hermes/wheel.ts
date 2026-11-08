import { PACKAGE_PATH_PREFIX } from '@zapbip/types';

export const ZAPBIP_HERMES_PLUGIN_VERSION = '0.1.0';
export const ZAPBIP_HERMES_WHEEL_SHA256 = '25e9eade35908bffc09ed502cde3f41bc4eb59ac6f7befefe4a8c0aba0b30ee1';
export const ZAPBIP_HERMES_REQUIREMENTS_SHA256 = 'fc258f304227f3eb44169c5416f581424296a876995c6499daaa42c7cf04cc31';
export const HERMES_WHEEL_FILENAME_PATTERN = /^zapbip_platform-\d+\.\d+\.\d+-py3-none-any\.whl$/;

export function hermesWheelFilename(input: { version: string }): string {
  return `zapbip_platform-${input.version}-py3-none-any.whl`;
}

export function hermesWheelPath(input: { version: string }): string {
  return `${PACKAGE_PATH_PREFIX}${hermesWheelFilename(input)}`;
}
export const HERMES_REQUIREMENTS_FILENAME_PATTERN = /^zapbip_platform-\d+\.\d+\.\d+-requirements\.txt$/;

export function hermesRequirementsFilename(input: { version: string }): string {
  return `zapbip_platform-${input.version}-requirements.txt`;
}

export function hermesRequirementsPath(input: { version: string }): string {
  return `${PACKAGE_PATH_PREFIX}${hermesRequirementsFilename(input)}`;
}
