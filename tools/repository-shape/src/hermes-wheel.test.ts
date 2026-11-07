import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { hermesRequirementsFilename, hermesWheelFilename, hermesWheelPath, PRODUCTION_PUBLIC_ORIGIN } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath, trackedFiles } from './repository-files';

const SHARED_CONSTANTS = 'libs/types/src/constants.ts';
const HERMES_PROJECT = 'apps/hermes-plugin/pyproject.toml';
const RELEASE_DIRECTORY = 'apps/hermes-plugin/release';
const SOURCE_DIRECTORY = 'apps/hermes-plugin/zapbip_platform';
const PACKAGE_DIRECTORY_NAME = 'zapbip_platform';
const METADATA_FILE = 'METADATA';
const VERSION_CONSTANT = 'ZAPBIP_HERMES_PLUGIN_VERSION';
const HASH_CONSTANT = 'ZAPBIP_HERMES_WHEEL_SHA256';
const REQUIREMENTS_HASH_CONSTANT = 'ZAPBIP_HERMES_REQUIREMENTS_SHA256';
const RUNTIME_LOCK = 'apps/hermes-plugin/requirements.txt';
const ENTRY_POINTS_FILE = 'entry_points.txt';
const HASH_FLAG = ' --hash=sha256:';
const PINNED_HEAD_PATTERN = /^[A-Za-z][\w.-]*==[\w.!+]+( ; .+)?$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const OWN_PACKAGE = 'zapbip-platform';
const PYTHON = 'python3';
const REMOVED_NAMES = ['ZAPBIP_PYPI_VERSION', 'ZAPBIP_PYPI_PUBLISHER', 'pypi.org'];
const RECORD_DIRECTORIES = ['docs/adr/', 'docs/learnings/', 'docs/features/'];
const THIS_TEST = 'tools/repository-shape/src/hermes-wheel.test.ts';

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

function requirementsFile(): string {
  return posix.join(RELEASE_DIRECTORY, hermesRequirementsFilename({ version: pluginVersion() }));
}

type RequirementBlock = { head: string; hashes: string[] };

function requirementBlocks({ text }: { text: string }): RequirementBlock[] {
  return text
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const [head, ...hashes] = line.split(HASH_FLAG);
      return { head: head as string, hashes };
    });
}

function nameOf({ head }: { head: string }): string {
  return head.split(/[=@ ]/)[0] as string;
}

function dependencyNamesOfProject(): string[] {
  const dependencies = /^dependencies = \[(.*)\]$/m.exec(readRepositoryFile(HERMES_PROJECT))?.[1];
  if (dependencies === undefined) throw new Error('the Hermes project declares no dependencies line');
  return [...dependencies.matchAll(/"([\w.-]+)[^"]*"/g)].map((match) => match[1] as string);
}

function requirementSpecifiers({ line }: { line: string }): string {
  const [, name, specifiers] = /^([\w.-]+)(.*)$/.exec(line.replace(/\s+/g, '')) as RegExpExecArray;
  return `${name} ${(specifiers as string).split(',').sort().join(',')}`;
}

function dependencyLinesOfProject(): string[] {
  const dependencies = /^dependencies = \[(.*)\]$/m.exec(readRepositoryFile(HERMES_PROJECT))?.[1];
  if (dependencies === undefined) throw new Error('the Hermes project declares no dependencies line');
  return [...dependencies.matchAll(/"([^"]+)"/g)].map((match) => match[1] as string);
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

  test('the release directory holds only the wheel and the requirements file of the current version', () => {
    const currentFiles = [hermesWheelFilename({ version: pluginVersion() }), hermesRequirementsFilename({ version: pluginVersion() })];
    expect(readdirSync(repositoryPath(RELEASE_DIRECTORY)).sort()).toEqual(currentFiles.sort());
  });

  test('the committed requirements file hashes to the constant', () => {
    const requirementsHash = createHash('sha256')
      .update(readFileSync(repositoryPath(requirementsFile())))
      .digest('hex');
    expect(requirementsHash).toBe(constantOf({ name: REQUIREMENTS_HASH_CONSTANT, pattern: '[0-9a-f]{64}' }));
  });

  test('every requirement is pinned with == and at least one sha256 hash', () => {
    const blocks = requirementBlocks({ text: readRepositoryFile(requirementsFile()) });
    const [own, ...dependencies] = blocks;
    expect(dependencies.length).toBeGreaterThan(0);
    expect(dependencies.filter((block) => !PINNED_HEAD_PATTERN.test(block.head))).toEqual([]);
    expect(blocks.filter((block) => block.hashes.length === 0 || !block.hashes.every((hash) => HASH_PATTERN.test(hash)))).toEqual([]);
    expect(own).toEqual({
      head: `${OWN_PACKAGE} @ ${PRODUCTION_PUBLIC_ORIGIN}${hermesWheelPath({ version: pluginVersion() })}`,
      hashes: [constantOf({ name: HASH_CONSTANT, pattern: '[0-9a-f]{64}' })],
    });
  });

  test('the requirements file lists the package and exactly the resolved runtime dependencies of the project', () => {
    const names = requirementBlocks({ text: readRepositoryFile(requirementsFile()) }).map(nameOf);
    const lockNames = requirementBlocks({ text: readRepositoryFile(RUNTIME_LOCK) }).map(nameOf);
    expect(names.sort()).toEqual([OWN_PACKAGE, ...lockNames].sort());
    dependencyNamesOfProject().forEach((name) => expect(names).toContain(name));
  });

  test('the wheel metadata and entry points match the project', () => {
    const extracted = extractedWheel();
    const files = packageFilesOf({ directory: extracted });
    const metadataFile = files.find((file) => file.endsWith(`.dist-info/${METADATA_FILE}`));
    const entryPointsFile = files.find((file) => file.endsWith(`.dist-info/${ENTRY_POINTS_FILE}`));
    if (metadataFile === undefined || entryPointsFile === undefined) throw new Error('the wheel has no METADATA or entry_points.txt');
    const required = [...readFileSync(join(extracted, metadataFile), 'utf8').matchAll(/^Requires-Dist: (.+)$/gm)]
      .map((match) => match[1] as string)
      .filter((line) => !line.includes('extra =='))
      .map((line) => requirementSpecifiers({ line: line.replace(/[()]/g, '') }));
    expect(required.sort()).toEqual(
      dependencyLinesOfProject()
        .map((line) => requirementSpecifiers({ line }))
        .sort(),
    );
    const entryPoints = readFileSync(join(extracted, entryPointsFile), 'utf8');
    expect(entryPoints).toContain('[hermes_agent.plugins]');
    expect(entryPoints).toContain('zapbip-platform = zapbip_platform');
  });

  test('no file outside the records names the removed PyPI constants or hosts', () => {
    const namingRemoved = trackedFiles()
      .filter((path) => path !== THIS_TEST)
      .filter((path) => !RECORD_DIRECTORIES.some((directory) => path.startsWith(directory)))
      .filter((path) => !path.endsWith('.whl'))
      .filter((path) => REMOVED_NAMES.some((name) => readRepositoryFile(path).includes(name)));
    expect(namingRemoved).toEqual([]);
  });
});
