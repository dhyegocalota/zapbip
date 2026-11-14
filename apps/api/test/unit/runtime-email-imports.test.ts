import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..', 'src');
const RENDERING_IMPORT_PATTERN = /from ['"](react|react-dom|@react-email)(\/[^'"]*)?['"]/;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

describe('the Worker source', () => {
  it('imports no React or React Email package, which render only at build time', () => {
    expect(listSourceFiles(SOURCE_ROOT).filter((path) => RENDERING_IMPORT_PATTERN.test(readFileSync(path, 'utf8')))).toEqual([]);
  });

  it('flags a rendering import', () => {
    expect(RENDERING_IMPORT_PATTERN.test("import { render } from '@react-email/render';")).toBe(true);
  });
});
