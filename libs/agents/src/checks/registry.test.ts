import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../contract';
import { definition as codexDefinition } from '../../supported/codex/definition';
import { definition as cursorDefinition } from '../../supported/cursor/definition';
import { registryViolationsOf } from './registry';

function withDelay(input: { expectedDelaySeconds: number | null }): AgentDefinition {
  return { ...cursorDefinition, listen: { ...cursorDefinition.listen, expectedDelaySeconds: input.expectedDelaySeconds } };
}

describe('registryViolationsOf', () => {
  test('accepts the real definitions', () => {
    const entries = [
      { id: 'cursor', definition: cursorDefinition },
      { id: 'codex', definition: codexDefinition },
    ];
    expect(registryViolationsOf({ entries })).toEqual([]);
  });

  test('rejects an uppercase folder name', () => {
    expect(registryViolationsOf({ entries: [{ id: 'Cursor', definition: cursorDefinition }] })).toEqual([
      'supported/Cursor: the folder name must match ^[a-z][a-z0-9-]*$',
    ]);
  });

  test('rejects the folder named like the matrix page', () => {
    expect(registryViolationsOf({ entries: [{ id: 'supported-agents', definition: cursorDefinition }] })).toEqual([
      'supported-agents is the matrix page',
    ]);
  });

  test('names a folder that has no definition', () => {
    expect(registryViolationsOf({ entries: [{ id: 'ghost', definition: null }] })).toEqual(['ghost: definition.ts is missing']);
  });

  test('names both folders that declare the same enum member', () => {
    const entries = [
      { id: 'codex', definition: codexDefinition },
      { id: 'other', definition: { ...cursorDefinition, enumMember: codexDefinition.enumMember } },
    ];
    expect(registryViolationsOf({ entries })).toEqual([`codex and other both declare the enumMember ${codexDefinition.enumMember}`]);
  });

  test('rejects an enum member that is not PascalCase', () => {
    const entries = [{ id: 'cursor', definition: { ...cursorDefinition, enumMember: 'chat_gpt' } }];
    expect(registryViolationsOf({ entries })).toEqual(['cursor: enumMember must be PascalCase']);
  });

  test.each([0, -1])('rejects an expected delay of %s seconds', (expectedDelaySeconds) => {
    expect(registryViolationsOf({ entries: [{ id: 'cursor', definition: withDelay({ expectedDelaySeconds }) }] })).toEqual([
      'cursor: expected delay must be positive or null',
    ]);
  });

  test.each([null, 7])('accepts an expected delay of %s', (expectedDelaySeconds) => {
    expect(registryViolationsOf({ entries: [{ id: 'cursor', definition: withDelay({ expectedDelaySeconds }) }] })).toEqual([]);
  });
});
