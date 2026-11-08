import { describe, expect, test } from 'vitest';
import { definition } from '../testing/fixture-agent/definition';
import { treeLeakViolationsOf } from './leak-scan';

const AGENTS = [{ id: 'fixture-agent', definition: { ...definition, idIsOrdinaryWord: false }, runtime: null }];

describe('treeLeakViolationsOf', () => {
  test.each(['js', 'cjs', 'cts', 'jsx', 'yaml', 'toml'])('scans a .%s file', (extension) => {
    const path = `tools/example.${extension}`;
    expect(treeLeakViolationsOf({ agents: AGENTS, files: [{ path, text: 'fixture-agent' }] })).toEqual([`${path}:1 names fixture-agent`]);
  });
});
