import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { trackedTextFiles } from './source';

let root = '';

function git(...args: string[]): void {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

function track(input: { path: string; text: string }): void {
  mkdirSync(dirname(join(root, input.path)), { recursive: true });
  writeFileSync(join(root, input.path), input.text);
  git('add', '--', input.path);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tracked-text-'));
  git('init', '--quiet');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('trackedTextFiles', () => {
  test('lists a path with non-ASCII characters', () => {
    track({ path: 'docs/guia-configuração.ts', text: 'one' });
    expect(trackedTextFiles({ root })).toEqual([{ path: 'docs/guia-configuração.ts', text: 'one' }]);
  });

  test('skips a tracked symlink instead of following it', () => {
    const outside = mkdtempSync(join(tmpdir(), 'outside-'));
    writeFileSync(join(outside, 'secret.ts'), 'outside');
    symlinkSync(join(outside, 'secret.ts'), join(root, 'link.ts'));
    git('add', '--', 'link.ts');
    track({ path: 'kept.ts', text: 'kept' });
    expect(trackedTextFiles({ root }).map((file) => file.path)).toEqual(['kept.ts']);
    rmSync(outside, { recursive: true, force: true });
  });

  test('skips a tracked file deleted from the working tree', () => {
    track({ path: 'gone.ts', text: 'x' });
    track({ path: 'kept.ts', text: 'kept' });
    rmSync(join(root, 'gone.ts'));
    expect(trackedTextFiles({ root }).map((file) => file.path)).toEqual(['kept.ts']);
  });

  test('fails on a listed path that cannot be read', () => {
    track({ path: 'locked.ts', text: 'x' });
    chmodSync(join(root, 'locked.ts'), 0);
    expect(() => trackedTextFiles({ root })).toThrow('locked.ts: cannot be read (EACCES)');
  });
});
