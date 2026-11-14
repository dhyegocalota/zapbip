import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { COMPANY } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const ROOT_LICENSE_FILE = 'LICENSE';
const ROOT_LICENSE_TITLE = 'GNU AFFERO GENERAL PUBLIC LICENSE';
const ROOT_LICENSE_IDENTIFIER = 'AGPL-3.0-only';
const CLIENT_LICENSE_TITLE = 'MIT License';
const CLIENT_LICENSE_IDENTIFIER = 'MIT';
const APPS_DIRECTORY = 'apps';
const PACKAGE_MANIFEST = 'package.json';
const PYTHON_MANIFEST = 'pyproject.toml';
const COMMUNITY_FILES = ['.github/CONTRIBUTING.md', '.github/SECURITY.md', '.github/CODE_OF_CONDUCT.md'];
const ISSUE_TEMPLATES = [
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
];
const PYPROJECT_LICENSE_LINE = `license = "${CLIENT_LICENSE_IDENTIFIER}"`;
const CHANGELOG_FILE = 'CHANGELOG.md';
const CHANGELOG_FORMAT_URL = 'https://keepachangelog.com';
const RELEASE_RUNBOOK = 'docs/runbooks/release.md';
const RELEASE_RUNBOOK_COMMANDS = ['git tag -a', 'git push origin', 'gh release create', '--notes-file', CHANGELOG_FILE];
const RELEASE_UPLOAD_COMMAND = 'gh release upload';
const README_FILE = 'README.md';
const HERO_PATTERN = /<p align="center">[\s\S]*?<img [^>]*src="https:\/\/zapbip\.com\/[^"]+"/;
const BADGE_PATTERN = /!\[[^\]]*\]\(https:\/\/img\.shields\.io\/[^)]+\)/g;
const MINIMUM_BADGES = 5;
const BADGE_SUBJECTS = ['license', 'stars', 'docs', 'website', 'PRs welcome'];
const README_HEADING_FRAGMENTS = [
  'Quick start',
  'How it works',
  'Supported agents',
  'Self-hosting',
  'Roadmap',
  'Community',
  'Contributors',
  'Star history',
  'License',
];
const README_IMAGE_HOSTS = [
  'https://contrib.rocks/image?repo=dhyegocalota/zapbip',
  'https://api.star-history.com/svg?repos=dhyegocalota/zapbip',
];
const RELEASE_ASSET_PATTERN = /releases\/download/;
const CODE_OWNERS_FILE = '.github/CODEOWNERS';
const CODE_OWNER = '@dhyegocalota';
const DEPENDABOT_FILE = '.github/dependabot.yml';
const CONTRIBUTOR_AGREEMENT_FILE = '.github/CLA.md';
const CONTRIBUTOR_AGREEMENT_LINK = 'CLA.md';
const CONTRIBUTOR_AGREEMENT_GRANTS = ['relicense', 'patent', 'original work', 'AGPL-3.0'];
const CONTRIBUTING_FILE = '.github/CONTRIBUTING.md';
const PULL_REQUEST_TEMPLATE = '.github/pull_request_template.md';
const CONTRIBUTOR_AGREEMENT_CHECKBOX = '- [ ] ✍️ I agree to the [Contributor License Agreement]';
const PYPROJECT_VERSION_PATTERN = /^version = "(.+)"$/m;

type PackageManifest = { private?: boolean; version?: string; license?: string; repository?: { directory?: string } };

function manifestOf(input: { path: string }): PackageManifest {
  return JSON.parse(readRepositoryFile(posix.join(input.path, PACKAGE_MANIFEST))) as PackageManifest;
}

function appFolders(): string[] {
  return readdirSync(repositoryPath(APPS_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => posix.join(APPS_DIRECTORY, entry.name));
}

function publishedNodePackages(): string[] {
  return appFolders().filter(
    (path) => existsSync(repositoryPath(posix.join(path, PACKAGE_MANIFEST))) && manifestOf({ path }).private !== true,
  );
}

function pythonPackages(): string[] {
  return appFolders().filter((path) => existsSync(repositoryPath(posix.join(path, PYTHON_MANIFEST))));
}

function versionOf(path: string): string {
  const pythonManifest = posix.join(path, PYTHON_MANIFEST);
  if (existsSync(repositoryPath(pythonManifest))) return PYPROJECT_VERSION_PATTERN.exec(readRepositoryFile(pythonManifest))![1]!;
  return manifestOf({ path }).version!;
}

const NODE_CLIENT_PACKAGES = publishedNodePackages();
const PYTHON_CLIENT_PACKAGES = pythonPackages();

describe('open source', () => {
  test('the client packages are found', () => {
    expect(NODE_CLIENT_PACKAGES.length).toBeGreaterThan(0);
  });

  test('the repository is licensed under the AGPL', () => {
    expect(readRepositoryFile(ROOT_LICENSE_FILE)).toContain(ROOT_LICENSE_TITLE);
    expect(manifestOf({ path: '.' }).license).toBe(ROOT_LICENSE_IDENTIFIER);
  });

  test.each(NODE_CLIENT_PACKAGES)('the client package %s carries its MIT license', (path) => {
    expect(readRepositoryFile(posix.join(path, ROOT_LICENSE_FILE))).toContain(CLIENT_LICENSE_TITLE);
  });

  test.each(NODE_CLIENT_PACKAGES)('the published package %s declares MIT and its folder in the repository', (path) => {
    const manifest = manifestOf({ path });
    expect(manifest.license).toBe(CLIENT_LICENSE_IDENTIFIER);
    expect(manifest.repository?.directory).toBe(path);
  });

  test('every Python client package carries and declares MIT', () => {
    PYTHON_CLIENT_PACKAGES.forEach((path) => {
      expect(readRepositoryFile(posix.join(path, ROOT_LICENSE_FILE))).toContain(CLIENT_LICENSE_TITLE);
      expect(readRepositoryFile(posix.join(path, PYTHON_MANIFEST))).toContain(PYPROJECT_LICENSE_LINE);
    });
  });

  test.each([...COMMUNITY_FILES, ...ISSUE_TEMPLATES])('%s exists', (path) => {
    expect(existsSync(repositoryPath(path))).toBe(true);
  });

  test('the README links the license and the community files', () => {
    const readme = readRepositoryFile('README.md');
    [ROOT_LICENSE_FILE, ...COMMUNITY_FILES].forEach((path) => expect(readme).toContain(`](${path})`));
  });

  test.each([...NODE_CLIENT_PACKAGES, ...PYTHON_CLIENT_PACKAGES])(
    'the published package %s keeps a changelog with its current version',
    (path) => {
      const changelog = readRepositoryFile(posix.join(path, CHANGELOG_FILE));
      expect(changelog).toContain(CHANGELOG_FORMAT_URL);
      expect(changelog).toContain(`## [${versionOf(path)}]`);
    },
  );

  test('the release runbook names the tag, the notes and no media upload', () => {
    const runbook = readRepositoryFile(RELEASE_RUNBOOK);
    expect(RELEASE_RUNBOOK_COMMANDS.filter((command) => !runbook.includes(command))).toEqual([]);
    expect(runbook).not.toContain(RELEASE_UPLOAD_COMMAND);
  });

  test('the README opens with a centered hero served by the site, never a release asset', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(readme).toMatch(HERO_PATTERN);
    expect(readme).not.toMatch(RELEASE_ASSET_PATTERN);
  });

  test('the README carries the badges of an open-source project', () => {
    const badges = [...readRepositoryFile(README_FILE).matchAll(BADGE_PATTERN)].map((match) => match[0]);
    expect(badges.length).toBeGreaterThanOrEqual(MINIMUM_BADGES);
    expect(BADGE_SUBJECTS.filter((subject) => !badges.some((badge) => badge.toLowerCase().includes(subject.toLowerCase())))).toEqual([]);
  });

  test('the README has the sections of an open-source project', () => {
    const headings = readRepositoryFile(README_FILE)
      .split('\n')
      .filter((line) => line.startsWith('## '));
    expect(README_HEADING_FRAGMENTS.filter((fragment) => !headings.some((heading) => heading.includes(fragment)))).toEqual([]);
  });

  test('the README shows the contributors and the star history', () => {
    const readme = readRepositoryFile(README_FILE);
    expect(README_IMAGE_HOSTS.filter((host) => !readme.includes(host))).toEqual([]);
  });

  test('the repository names its code owner', () => {
    expect(readRepositoryFile(CODE_OWNERS_FILE)).toContain(CODE_OWNER);
  });

  test('no dependabot configuration opens update pull requests', () => {
    expect(existsSync(repositoryPath(DEPENDABOT_FILE))).toBe(false);
  });

  test('the contributor license agreement names the company and what it grants', () => {
    const agreement = readRepositoryFile(CONTRIBUTOR_AGREEMENT_FILE);
    expect(agreement).toContain(COMPANY.legalName);
    expect(CONTRIBUTOR_AGREEMENT_GRANTS.filter((grant) => !agreement.includes(grant))).toEqual([]);
  });

  test('contributing and the pull request template ask for the agreement', () => {
    expect(readRepositoryFile(CONTRIBUTING_FILE)).toContain(CONTRIBUTOR_AGREEMENT_LINK);
    expect(readRepositoryFile(PULL_REQUEST_TEMPLATE)).toContain(CONTRIBUTOR_AGREEMENT_CHECKBOX);
  });
});
