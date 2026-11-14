import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { leakViolationsOf } from '@zapbip/agents/checks/leaks';
import { registeredLeakAgents } from '@zapbip/agents/checks/registered-agents';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath, trackedFiles } from './repository-files';

const BASELINE_FILE = 'tools/repository-shape/prose-leak-baseline.json';
const WRITE_VARIABLE = 'WRITE_PROSE_LEAK_BASELINE';
const PROSE_PATTERN = /\.(md|mdx)$/;
const DOCS_ROOT = 'apps/docs/';
const PUBLIC_README_FILES = ['README.md', 'apps/connector/README.md', 'apps/api/README.md'];
const AGENT_PAGE_PATTERN = /^apps\/docs\/([a-z-]+\/)?agents\//;
const AGENT_SNIPPET_PATTERN = /^apps\/docs\/snippets\/([a-z-]+\/)?agents\//;
const JSON_INDENT = 2;

type Baseline = Record<string, number>;

function isPublicProse(path: string): boolean {
  if (!PROSE_PATTERN.test(path)) return false;
  if (PUBLIC_README_FILES.includes(path)) return true;
  if (!path.startsWith(DOCS_ROOT)) return false;
  return !AGENT_PAGE_PATTERN.test(path) && !AGENT_SNIPPET_PATTERN.test(path);
}

function countsOf(): Baseline {
  const agents = registeredLeakAgents();
  const files = trackedFiles()
    .filter(isPublicProse)
    .map((path) => ({ path, text: readRepositoryFile(path) }));
  const violations = leakViolationsOf({ agents, files, allowedPrefixes: [], literalExemptPrefixes: [] });
  const counts: Baseline = {};
  violations.forEach((violation) => {
    const path = violation.slice(0, violation.indexOf(':'));
    counts[path] = (counts[path] === undefined ? 0 : counts[path]) + 1;
  });
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => (left < right ? -1 : 1)));
}

function baselineOf(): Baseline {
  if (!existsSync(repositoryPath(BASELINE_FILE))) return {};
  return JSON.parse(readFileSync(repositoryPath(BASELINE_FILE), 'utf8')) as Baseline;
}

describe('prose that names an agent outside its own pages', () => {
  const counts = countsOf();
  if (process.env[WRITE_VARIABLE] === '1') writeFileSync(repositoryPath(BASELINE_FILE), `${JSON.stringify(counts, null, JSON_INDENT)}\n`);
  const baseline = baselineOf();

  test('no page names an agent more than the baseline allows', () => {
    const grown = Object.entries(counts).filter(([path, count]) => count > (baseline[path] === undefined ? 0 : baseline[path]));
    expect(grown.map(([path]) => path)).toEqual([]);
  });

  test('the baseline only shrinks: a page that improved lowers its number', () => {
    const stale = Object.entries(baseline).filter(([path, allowed]) => (counts[path] === undefined ? 0 : counts[path]) < allowed);
    expect(stale.map(([path]) => path)).toEqual([]);
  });
});
