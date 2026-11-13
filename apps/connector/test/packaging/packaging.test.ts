import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLE_FILE = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const EXPECTED_FILES = ['LICENSE', 'README.md', 'dist/cli.js', 'package.json'];
const SHEBANG = '#!/usr/bin/env node';

type PackedFile = { path: string };
type PackReport = { files: PackedFile[] }[];

function packedFilePaths(): string[] {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: PACKAGE_DIRECTORY, encoding: 'utf8' });
  const [report] = JSON.parse(output) as PackReport;
  return (report as PackReport[number]).files.map((file) => file.path).sort();
}

function manifest(): { bin: Record<string, string>; dependencies?: Record<string, string>; private?: boolean } {
  return JSON.parse(readFileSync(`${PACKAGE_DIRECTORY}/package.json`, 'utf8'));
}

describe('the npm package', () => {
  it('lists only the bundle, the license, the readme and the manifest', () => {
    expect(packedFilePaths()).toEqual(EXPECTED_FILES);
  });

  it('exposes the zapbip command from the bundle', () => {
    expect(manifest().bin).toEqual({ zapbip: 'dist/cli.js' });
  });

  it('is not private, so the owner can publish it', () => {
    expect(manifest().private).toBeUndefined();
  });

  it('starts the bundle with the node shebang', () => {
    expect(readFileSync(BUNDLE_FILE, 'utf8').split('\n')[0]).toBe(SHEBANG);
  });

  it('declares no runtime dependency', () => {
    expect(manifest().dependencies).toBeUndefined();
  });

  it('keeps test code out of the bundle', () => {
    const bundle = readFileSync(BUNDLE_FILE, 'utf8');
    expect(bundle).not.toContain('vitest');
    expect(bundle).not.toContain('fake-event-server');
  });
});
