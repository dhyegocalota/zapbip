import { describe, expect, test } from 'vitest';
import { HERMES_WHEEL_PATH_PREFIX, hermesWheelFilename, hermesWheelPath } from './hermes-wheel';

const VERSION = '0.1.0';
const FILENAME = 'zapbip_platform-0.1.0-py3-none-any.whl';

describe('the Hermes wheel names', () => {
  test('the filename carries the version in the wheel naming scheme', () => {
    expect(hermesWheelFilename({ version: VERSION })).toBe(FILENAME);
  });

  test('the path is the filename under the package prefix', () => {
    expect(hermesWheelPath({ version: VERSION })).toBe(`${HERMES_WHEEL_PATH_PREFIX}${FILENAME}`);
    expect(hermesWheelPath({ version: VERSION })).toBe(`/pkg/${FILENAME}`);
  });
});
