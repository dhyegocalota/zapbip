import { describe, expect, test } from 'vitest';
import {
  HERMES_REQUIREMENTS_FILENAME_PATTERN,
  HERMES_WHEEL_FILENAME_PATTERN,
  HERMES_WHEEL_PATH_PREFIX,
  hermesRequirementsFilename,
  hermesRequirementsPath,
  hermesWheelFilename,
  hermesWheelPath,
} from './hermes-wheel';

const VERSION = '0.1.0';
const FILENAME = 'zapbip_platform-0.1.0-py3-none-any.whl';
const REQUIREMENTS_FILENAME = 'zapbip_platform-0.1.0-requirements.txt';

describe('the Hermes wheel names', () => {
  test('the filename carries the version in the wheel naming scheme', () => {
    expect(hermesWheelFilename({ version: VERSION })).toBe(FILENAME);
  });

  test('the path is the filename under the package prefix', () => {
    expect(hermesWheelPath({ version: VERSION })).toBe(`${HERMES_WHEEL_PATH_PREFIX}${FILENAME}`);
    expect(hermesWheelPath({ version: VERSION })).toBe(`/pkg/${FILENAME}`);
  });
});

describe('the Hermes requirements file names', () => {
  test('the filename carries the version', () => {
    expect(hermesRequirementsFilename({ version: VERSION })).toBe(REQUIREMENTS_FILENAME);
  });

  test('the path is the filename under the package prefix', () => {
    expect(hermesRequirementsPath({ version: VERSION })).toBe(`/pkg/${REQUIREMENTS_FILENAME}`);
  });

  test('each pattern accepts only its own file', () => {
    expect(HERMES_REQUIREMENTS_FILENAME_PATTERN.test(REQUIREMENTS_FILENAME)).toBe(true);
    expect(HERMES_REQUIREMENTS_FILENAME_PATTERN.test(FILENAME)).toBe(false);
    expect(HERMES_WHEEL_FILENAME_PATTERN.test(REQUIREMENTS_FILENAME)).toBe(false);
    expect(HERMES_REQUIREMENTS_FILENAME_PATTERN.test(`${REQUIREMENTS_FILENAME}\n`)).toBe(false);
  });
});
