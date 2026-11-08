import { DISPLAY_NUMBER_PATTERN } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_NUMBER } from '../../src/dev/development-number';

describe('DEVELOPMENT_NUMBER', () => {
  it('seeds a display number that the start link accepts', () => {
    expect(DEVELOPMENT_NUMBER.displayNumber).toMatch(DISPLAY_NUMBER_PATTERN);
  });
});
