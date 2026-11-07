import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { formatChoiceOptionIds, formatOptionId, formatRouteOptionId, parseOptionId, parseRouteOptionId } from './option-id';

describe('option ids', () => {
  test('CU-52 formatOptionId', () => {
    expect(formatOptionId({ questionId: 'qst_1', optionIndex: 0 })).toBe('qst_1:0');
  });

  test('CU-53 parseOptionId round trip', () => {
    expect(parseOptionId({ optionId: 'qst_1:2' })).toEqual({ questionId: 'qst_1', optionIndex: 2 });
  });

  test('CU-54 parseOptionId without an index', () => {
    expect(parseOptionId({ optionId: 'qst_1' })).toBeNull();
  });

  test('CU-55 parseOptionId with a non-numeric index', () => {
    expect(parseOptionId({ optionId: 'qst_1:x' })).toBeNull();
  });

  test('CU-56 formatRouteOptionId', () => {
    expect(formatRouteOptionId({ messageId: 'msg_1', agent: 'beta' })).toBe('route:msg_1:beta');
  });

  test('CU-57 parseRouteOptionId round trip', () => {
    expect(parseRouteOptionId({ optionId: 'route:msg_1:beta' })).toEqual({ messageId: 'msg_1', agent: 'beta' });
  });

  test('CU-58 parseRouteOptionId with the wrong prefix', () => {
    expect(parseRouteOptionId({ optionId: 'qst_1:0' })).toBeNull();
  });

  test('a route id is not a question option id', () => {
    expect(parseOptionId({ optionId: 'route:msg_1:beta' })).toBeNull();
  });
});

describe('formatChoiceOptionIds', () => {
  const options = [
    { optionIndex: 0, title: 'alpha', description: null },
    { optionIndex: 1, title: 'beta', description: null },
  ];

  test('a question prompt numbers its options', () => {
    expect(formatChoiceOptionIds({ questionId: 'qst_1', options })).toEqual(['qst_1:0', 'qst_1:1']);
  });

  test('a routing list names the agent of each option', () => {
    expect(formatChoiceOptionIds({ questionId: 'route:msg_1', options })).toEqual(['route:msg_1:alpha', 'route:msg_1:beta']);
  });
});

describe('option ids of rows that carry their own id', () => {
  test('a row id on the option is the option id, whatever the question', () => {
    const options = [
      { optionIndex: 0, title: 'A', description: null, rowId: 'custom:first' },
      { optionIndex: 1, title: 'B', description: null, rowId: 'custom:second' },
    ];
    expect(formatChoiceOptionIds({ questionId: 'any_question', options })).toEqual(['custom:first', 'custom:second']);
  });

  test('the option id module does not import the accounts module', () => {
    const source = readFileSync(join(import.meta.dirname, 'option-id.ts'), 'utf8');
    expect(source).not.toMatch(/from '\.\.\/accounts/);
  });
});
