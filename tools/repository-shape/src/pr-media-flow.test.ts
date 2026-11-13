import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath, trackedFiles } from './repository-files';

const HARNESS_PREFIXES = ['.agents/', '.claude/', '.codex/', 'docs/scenarios/'];
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const PR_MEDIA_SCRIPT = 'scripts/pr-media.sh';
const RELEASE_UPLOAD_PATTERN = /gh release upload|releases\/download\/pr-media|pr-media-(<slug>|[a-z0-9])/;
const MEDIA_REPOSITORY = 'dhyegocalota/zapbip-pr-media';
const MEDIA_FLOW_FILES = [
  '.agents/roles/recorder.md',
  '.agents/skills/check-ui/SKILL.md',
  '.agents/skills/open-pr/SKILL.md',
  '.claude/HARNESS.md',
];

function harnessFiles(): string[] {
  return trackedFiles().filter((path) => path === PULL_REQUEST_TEMPLATE || HARNESS_PREFIXES.some((prefix) => path.startsWith(prefix)));
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
    const unnamed = MEDIA_FLOW_FILES.filter((path) => !readRepositoryFile(path).includes(PR_MEDIA_SCRIPT));
    expect(unnamed).toEqual([]);
  });

  test('the media script targets the private media repository', () => {
    expect(readRepositoryFile(PR_MEDIA_SCRIPT)).toContain(MEDIA_REPOSITORY);
  });
});
