import { describe, expect, test } from 'vitest';
import { constantNameOf, pascalCaseOf } from './identifiers';

describe('the names derived from an id', () => {
  test('turns an id into a member name', () => {
    expect(pascalCaseOf({ id: 'probe-i-1' })).toBe('ProbeI1');
    expect(pascalCaseOf({ id: 'probe-i1' })).toBe('ProbeI1');
  });

  test('turns an id into a constant name', () => {
    expect(constantNameOf({ id: 'probe-i-1' })).toBe('PROBE_I_1');
    expect(constantNameOf({ id: 'probe-i1' })).toBe('PROBE_I1');
  });
});
