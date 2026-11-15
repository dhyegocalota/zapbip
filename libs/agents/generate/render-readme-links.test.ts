import { describe, expect, test } from 'vitest';
import { prunedReadmeOf, renderReadmeLinks } from './render-readme-links';

function listSourceFrom(directory: string): string[] {
  if (directory === '') return ['apps', 'libs'];
  if (directory === 'apps') return ['docs', 'connector'];
  return [];
}

describe('prunedReadmeOf', () => {
  test('drops the table row of a folder that no longer exists and keeps the rest of the file', () => {
    const source = [
      '# zapbip',
      '',
      '| Folder | Purpose |',
      '| --- | --- |',
      '| [apps/docs](apps/docs/) | The docs |',
      '| [apps/retired-plugin](apps/retired-plugin/) | The Retired plugin |',
      '',
      'Prose stays.',
      '',
    ].join('\n');
    const pruned = prunedReadmeOf({ path: 'README.md', source, listSource: listSourceFrom });
    expect(pruned).toEqual({
      path: 'README.md',
      content: [
        '# zapbip',
        '',
        '| Folder | Purpose |',
        '| --- | --- |',
        '| [apps/docs](apps/docs/) | The docs |',
        '',
        'Prose stays.',
        '',
      ].join('\n'),
    });
  });

  test('resolves the folder against the directory of a nested README', () => {
    const source = '| [docs](docs/) | Docs |\n| [retired-plugin](retired-plugin/) | Retired |\n';
    const pruned = prunedReadmeOf({ path: 'apps/README.md', source, listSource: listSourceFrom });
    expect(pruned.content).toBe('| [docs](docs/) | Docs |\n');
  });

  test('keeps a table row whose link is not a folder and a line that is not a table row', () => {
    const source = '| [page](guide.md) | Guide |\nSee [apps/gone/](apps/gone/) in prose.\n';
    expect(prunedReadmeOf({ path: 'README.md', source, listSource: listSourceFrom }).content).toBe(source);
  });
});

describe('renderReadmeLinks', () => {
  test('writes only the README files that lose a row', () => {
    const sources: Record<string, string> = {
      'README.md': '| [apps/docs](apps/docs/) | Docs |\n| [apps/gone](apps/gone/) | Gone |\n',
      'apps/README.md': '| [docs](docs/) | Docs |\n',
    };
    const files = renderReadmeLinks({ readSource: (path) => sources[path] as string, listSource: listSourceFrom });
    expect(files).toEqual([{ path: 'README.md', content: '| [apps/docs](apps/docs/) | Docs |\n' }]);
  });
});
