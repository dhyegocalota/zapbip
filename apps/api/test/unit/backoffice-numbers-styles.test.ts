import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BACKOFFICE_ROOT = join(import.meta.dirname, '../../src/backoffice');
const STYLESHEET = readFileSync(join(BACKOFFICE_ROOT, 'assets/backoffice.css'), 'utf8');
const KEY_VALUE_CLASS = 'key-value';
const CHOICE_CLASS = 'choice';

function sourcesIn(input: { directory: string }): string[] {
  return readdirSync(input.directory).flatMap((name) => {
    const path = join(input.directory, name);
    if (statSync(path).isDirectory()) return sourcesIn({ directory: path });
    return name.endsWith('.tsx') ? [readFileSync(path, 'utf8')] : [];
  });
}

const NUMBER_VIEWS = sourcesIn({ directory: join(BACKOFFICE_ROOT, 'numbers') }).join('\n');

describe('the styles the numbers pages ask for', () => {
  it.each([KEY_VALUE_CLASS, CHOICE_CLASS])('defines .%s in the shared stylesheet', (name) => {
    expect(STYLESHEET).toContain(`.${name}`);
  });

  it('gives every definition list of the numbers pages the key-value class', () => {
    const lists = NUMBER_VIEWS.match(/<dl[^>]*>/g);
    expect(lists).not.toBeNull();
    expect(lists?.every((list) => list.includes(`class="${KEY_VALUE_CLASS}"`))).toBe(true);
  });

  it('gives every radio and checkbox label of the numbers pages the choice class', () => {
    const labels = NUMBER_VIEWS.match(/<label[^>]*>\s*<input type="(radio|checkbox)"/g);
    expect(labels).not.toBeNull();
    expect(labels?.every((label) => label.includes(`class="${CHOICE_CLASS}"`))).toBe(true);
  });
});

describe('the audit table at narrow widths', () => {
  it('lets the mono cells of a data table wrap at any character', () => {
    expect(STYLESHEET).toMatch(/\.data-table\s+\.mono\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});
