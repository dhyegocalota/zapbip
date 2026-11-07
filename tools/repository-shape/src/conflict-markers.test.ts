import { describe, expect, test } from 'vitest';
import { conflictMarkerLines, readRepositoryFile, trackedFiles } from './repository-files';

const MARKER_WIDTH = 7;
const OURS_MARKER = '<'.repeat(MARKER_WIDTH);
const SEPARATOR_MARKER = '='.repeat(MARKER_WIDTH);
const THEIRS_MARKER = '>'.repeat(MARKER_WIDTH);
const BINARY_BYTE = '\u0000';

function filesWithConflictMarkers(): string[] {
  return trackedFiles().filter((path) => {
    const text = readRepositoryFile(path);
    return !text.includes(BINARY_BYTE) && conflictMarkerLines(text).length > 0;
  });
}

describe('merge conflict markers', () => {
  test('a conflicted block is reported by line', () => {
    const text = [`${OURS_MARKER} HEAD`, 'ours', SEPARATOR_MARKER, 'theirs', `${THEIRS_MARKER} origin/main`].join('\n');
    expect(conflictMarkerLines(text)).toEqual([1, 3, 5]);
  });

  test('text that merely mentions markers is not reported', () => {
    expect(conflictMarkerLines(`a ${OURS_MARKER} b\n${SEPARATOR_MARKER}=\n`)).toEqual([]);
  });

  test('no tracked text file holds a conflict marker line', () => {
    expect(filesWithConflictMarkers()).toEqual([]);
  });
});
