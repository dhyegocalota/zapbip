import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderTerminalQr } from '../../scripts/backoffice-enroll';

const OTPAUTH_URI =
  'otpauth://totp/zapbip%20backoffice%20(development):operator?secret=JBSWY3DPEHPK3PXP&issuer=zapbip&algorithm=SHA1&digits=6&period=30';
const FINDER_SIZE = 7;
const FINDER_COUNT = 3;
const HALF_BLOCKS: Record<string, [boolean, boolean]> = {
  '█': [true, true],
  '▀': [true, false],
  '▄': [false, true],
  ' ': [false, false],
};
const FINDER_PATTERN = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

function modulesOf(input: { lines: string[] }): boolean[][] {
  return input.lines.flatMap((line) => {
    const pairs = [...line].map((character) => HALF_BLOCKS[character]!);
    return [pairs.map(([top]) => top), pairs.map(([, bottom]) => bottom)];
  });
}

function findersIn(input: { modules: boolean[][] }): number {
  const { modules } = input;
  const origins = modules.flatMap((row, rowIndex) => row.map((_, columnIndex) => ({ rowIndex, columnIndex })));
  return origins.filter(({ rowIndex, columnIndex }) =>
    FINDER_PATTERN.every((patternRow, rowOffset) =>
      patternRow.every((cell, columnOffset) => modules[rowIndex + rowOffset]?.[columnIndex + columnOffset] === Boolean(cell)),
    ),
  ).length;
}

describe('terminal QR', () => {
  const qr = renderTerminalQr({ text: OTPAUTH_URI });
  const lines = qr.split('\n').filter((line) => line.length > 0);

  it('renders several lines of one width', () => {
    expect(lines.length).toBeGreaterThan(FINDER_SIZE);
    expect(new Set(lines.map((line) => [...line].length)).size).toBe(1);
  });

  it('draws only half-block characters', () => {
    expect([...new Set(lines.join(''))].every((character) => character in HALF_BLOCKS)).toBe(true);
  });

  it('holds the three finder patterns', () => {
    expect(findersIn({ modules: modulesOf({ lines }) })).toBe(FINDER_COUNT);
  });

  it('pins uqr to an exact version', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies.uqr).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
