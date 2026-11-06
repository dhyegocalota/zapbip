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
