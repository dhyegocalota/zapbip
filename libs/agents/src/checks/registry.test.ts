import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../contract';
import { definition as connectorFixtureDefinition } from '../../testing/fixture-connector-agent/definition';
import { definition as installFixtureDefinition } from '../../testing/fixture-agent/definition';
import { registryViolationsOf } from './registry';

function withDelay(input: { expectedDelaySeconds: number | null }): AgentDefinition {
  return { ...installFixtureDefinition, listen: { ...installFixtureDefinition.listen, expectedDelaySeconds: input.expectedDelaySeconds } };
}

describe('registryViolationsOf', () => {
  test('accepts the real definitions', () => {
    const entries = [
      { id: 'sample', definition: installFixtureDefinition },
      { id: 'connector-sample', definition: connectorFixtureDefinition },
    ];
    expect(registryViolationsOf({ entries })).toEqual([]);
  });

  test('rejects an uppercase folder name', () => {
    expect(registryViolationsOf({ entries: [{ id: 'Sample', definition: installFixtureDefinition }] })).toEqual([
      'supported/Sample: the folder name must match ^[a-z][a-z0-9-]*$',
    ]);
  });

  test('rejects the folder named like the matrix page', () => {
    expect(registryViolationsOf({ entries: [{ id: 'supported-agents', definition: installFixtureDefinition }] })).toEqual([
      'supported-agents is the matrix page',
    ]);
  });

  test('names a folder that has no definition', () => {
    expect(registryViolationsOf({ entries: [{ id: 'ghost', definition: null }] })).toEqual(['ghost: definition.ts is missing']);
  });

  test('names both folders that declare the same enum member', () => {
    const entries = [
      { id: 'connector-sample', definition: connectorFixtureDefinition },
      { id: 'other', definition: { ...installFixtureDefinition, enumMember: connectorFixtureDefinition.enumMember } },
    ];
    expect(registryViolationsOf({ entries })).toEqual([
      `connector-sample and other both declare the enumMember ${connectorFixtureDefinition.enumMember}`,
    ]);
  });

  test('rejects an enum member that is not PascalCase', () => {
    const entries = [{ id: 'sample', definition: { ...installFixtureDefinition, enumMember: 'chat_gpt' } }];
    expect(registryViolationsOf({ entries })).toEqual(['sample: enumMember must be PascalCase']);
  });

  test.each([0, -1])('rejects an expected delay of %s seconds', (expectedDelaySeconds) => {
    expect(registryViolationsOf({ entries: [{ id: 'sample', definition: withDelay({ expectedDelaySeconds }) }] })).toEqual([
      'sample: expected delay must be positive or null',
    ]);
  });

  test.each([null, 7])('accepts an expected delay of %s', (expectedDelaySeconds) => {
    expect(registryViolationsOf({ entries: [{ id: 'sample', definition: withDelay({ expectedDelaySeconds }) }] })).toEqual([]);
  });
});
