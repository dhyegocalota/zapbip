import { PACKAGE_PATH_PREFIX } from '@zapbip/types';

export const PLUGIN_VERSION = '0.2.0';
export const WHEEL_SHA256 = '8e6fabc2ab416e939864b7ee176d0037ddfdc0ef161641c4cc0d61413ccb6ee7';
export const REQUIREMENTS_SHA256 = '5e3c28d1d8170431504b4fe3780e897ac80c5fd3d134ce8ad5f9abf214ecd3f4';
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
