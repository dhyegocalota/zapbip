import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = join(import.meta.dirname, '..', '..', 'src');
const INTERPOLATED_SQL_PATTERN = /`[^`]*\b(SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^`]*\$\{/i;
const DRIZZLE_TAGGED_TEMPLATE_PATTERN = /\bsql`/;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function findInterpolatedSql(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => INTERPOLATED_SQL_PATTERN.test(line) && !DRIZZLE_TAGGED_TEMPLATE_PATTERN.test(line))
    .map((line) => `${path}: ${line.trim()}`);
}

describe('bound SQL', () => {
  it('has no template literal that interpolates into a statement', () => {
    expect(listSourceFiles(SOURCE_ROOT).flatMap(findInterpolatedSql)).toEqual([]);
  });

  it('flags an interpolated statement', () => {
    const line = 'database.prepare(`SELECT * FROM connections WHERE id = ${id}`)';
    expect(INTERPOLATED_SQL_PATTERN.test(line)).toBe(true);
  });

  it('accepts a bound statement', () => {
    const line = "database.prepare('SELECT * FROM connections WHERE id = ?')";
    expect(INTERPOLATED_SQL_PATTERN.test(line)).toBe(false);
  });
});
