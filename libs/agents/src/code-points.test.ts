import { describe, expect, test } from 'vitest';
import { compareCodePoints } from './code-points';

describe('compareCodePoints', () => {
  test('puts an uppercase letter before a lowercase one, which a locale does not', () => {
    expect(['b', 'B', 'a', 'A'].sort((left, right) => compareCodePoints({ left, right }))).toEqual(['A', 'B', 'a', 'b']);
  });

  test('orders a prefix before its extension and equal strings as equal', () => {
    expect(compareCodePoints({ left: 'agent', right: 'agent-two' })).toBeLessThan(0);
    expect(compareCodePoints({ left: 'agent', right: 'agent' })).toBe(0);
  });

  test('orders by the characters, not by accents or case folding', () => {
    expect(compareCodePoints({ left: 'z', right: 'á' })).toBeLessThan(0);
  });
});
