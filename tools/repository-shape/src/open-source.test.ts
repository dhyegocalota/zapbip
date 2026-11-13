import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
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

type PackageManifest = { private?: boolean; license?: string; repository?: { directory?: string } };

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
});
