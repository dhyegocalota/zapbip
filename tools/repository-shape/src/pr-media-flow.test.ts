import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath, trackedFiles } from './repository-files';

const SCENARIOS_PREFIX = 'docs/scenarios/';
const DOT_ENTRY_PREFIX = '.';
const GIT_ENTRY_PREFIX = '.git';
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const PR_MEDIA_SCRIPT = 'scripts/pr-media.sh';
const RELEASE_UPLOAD_PATTERN = /gh release upload|releases\/download\/pr-media|pr-media-(<slug>|[a-z0-9])/;
const MEDIA_REPOSITORY = 'dhyegocalota/zapbip-pr-media';
const HARNESS_DOCUMENT_SUFFIX = '/HARNESS.md';
const MEDIA_FLOW_FILES = ['.agents/roles/recorder.md', '.agents/skills/check-ui/SKILL.md', '.agents/skills/open-pr/SKILL.md'];

function isHarnessFile(path: string): boolean {
  const isAgentSurface = path.startsWith(DOT_ENTRY_PREFIX) && !path.startsWith(GIT_ENTRY_PREFIX);
  return path === PULL_REQUEST_TEMPLATE || path.startsWith(SCENARIOS_PREFIX) || isAgentSurface;
}

function harnessFiles(): string[] {
  return trackedFiles().filter(isHarnessFile);
}

describe('the pull request media flow', () => {
  test('the harness files are found', () => {
    expect(harnessFiles().length).toBeGreaterThan(0);
  });

  test('no harness file uploads to Releases or names a pr-media release', () => {
    const offenders = harnessFiles().filter((path) => RELEASE_UPLOAD_PATTERN.test(readRepositoryFile(path)));
    expect(offenders).toEqual([]);
  });

  test('the media script exists and the flow files name it', () => {
    expect(existsSync(repositoryPath(PR_MEDIA_SCRIPT))).toBe(true);
    const harnessDocument = harnessFiles().filter((path) => path.endsWith(HARNESS_DOCUMENT_SUFFIX));
    const unnamed = [...MEDIA_FLOW_FILES, ...harnessDocument].filter((path) => !readRepositoryFile(path).includes(PR_MEDIA_SCRIPT));
    expect(unnamed).toEqual([]);
  });

  test('the media script targets the private media repository', () => {
    expect(readRepositoryFile(PR_MEDIA_SCRIPT)).toContain(MEDIA_REPOSITORY);
  });
});
