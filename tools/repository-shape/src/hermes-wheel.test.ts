import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { hermesWheelFilename } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const HERMES_PROJECT = 'apps/hermes-plugin/pyproject.toml';
const RELEASE_DIRECTORY = 'apps/hermes-plugin/release';
const SOURCE_DIRECTORY = 'apps/hermes-plugin/zapbip_platform';
const PACKAGE_DIRECTORY_NAME = 'zapbip_platform';
const METADATA_FILE = 'METADATA';
const VERSION_CONSTANT = 'ZAPBIP_HERMES_PLUGIN_VERSION';
const HASH_CONSTANT = 'ZAPBIP_HERMES_WHEEL_SHA256';
const PYTHON = 'python3';

function constantOf({ name, pattern }: { name: string; pattern: string }): string {
  const value = new RegExp(`export const ${name} = '(${pattern})'`).exec(readRepositoryFile(SHARED_CONSTANTS))?.[1];
  if (value === undefined) throw new Error(`${name} is not exported from ${SHARED_CONSTANTS}`);
  return value;
}

function pluginVersion(): string {
  return constantOf({ name: VERSION_CONSTANT, pattern: "[^']+" });
}

function wheelFile(): string {
  return posix.join(RELEASE_DIRECTORY, hermesWheelFilename({ version: pluginVersion() }));
}

function extractedWheel(): string {
  const directory = mkdtempSync(join(tmpdir(), 'zapbip-wheel-'));
  const extraction = spawnSync(PYTHON, ['-I', '-m', 'zipfile', '-e', repositoryPath(wheelFile()), directory], { encoding: 'utf8' });
  if (extraction.status !== 0) throw new Error(`could not unzip ${wheelFile()}: ${extraction.stderr}`);
  return directory;
}

function packageFilesOf({ directory }: { directory: string }): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1))
    .sort();
}

describe('the Hermes wheel', () => {
  test('the committed wheel hashes to the constant', () => {
    const wheelHash = createHash('sha256')
      .update(readFileSync(repositoryPath(wheelFile())))
      .digest('hex');
    expect(wheelHash).toBe(constantOf({ name: HASH_CONSTANT, pattern: '[0-9a-f]{64}' }));
  });

  test('the committed wheel carries exactly the plugin source', () => {
    const extracted = join(extractedWheel(), PACKAGE_DIRECTORY_NAME);
    const sourceFiles = repositoryFiles(SOURCE_DIRECTORY).map((path) => posix.relative(SOURCE_DIRECTORY, path));
    const wheelFiles = packageFilesOf({ directory: extracted });
    expect(wheelFiles).toEqual(sourceFiles.sort());
    wheelFiles.forEach((file) =>
      expect(readFileSync(join(extracted, file))).toEqual(readFileSync(repositoryPath(posix.join(SOURCE_DIRECTORY, file)))),
    );
  });

  test('the constant, the project and the wheel metadata declare one version', () => {
    const version = pluginVersion();
    const projectVersion = /^version = "([^"]+)"/m.exec(readRepositoryFile(HERMES_PROJECT))?.[1];
    const extracted = extractedWheel();
    const metadataFile = packageFilesOf({ directory: extracted }).find((file) => file.endsWith(`.dist-info/${METADATA_FILE}`));
    if (metadataFile === undefined) throw new Error('the wheel has no METADATA');
    const metadataVersion = /^Version: (\S+)/m.exec(readFileSync(join(extracted, metadataFile), 'utf8'))?.[1];
    expect(projectVersion).toBe(version);
    expect(metadataVersion).toBe(version);
  });

  test('the release directory holds only the wheel of the current version', () => {
    const currentWheel = hermesWheelFilename({ version: pluginVersion() });
    expect(readdirSync(repositoryPath(RELEASE_DIRECTORY))).toEqual([currentWheel]);
  });
});
