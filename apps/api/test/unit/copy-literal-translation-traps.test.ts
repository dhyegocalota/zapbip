import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
const SOURCE_ROOT = join(REPOSITORY_ROOT, 'apps/api/src');
const DOCS_ROOT = join(REPOSITORY_ROOT, 'apps/docs');
const AGENTS_ROOT = join(REPOSITORY_ROOT, 'libs/agents/supported');
const COPY_FILE_PATTERN = /(copy|templates)[a-z-]*\.ts$/;

interface LanguageTraps {
  name: string;
  docsFolder: string;
  pageSuffix: string;
  sourceFile: (path: string) => boolean;
  traps: RegExp;
}

const LANGUAGES: LanguageTraps[] = [
  {
    name: 'pt-BR',
    docsFolder: 'pt-br',
    pageSuffix: 'page.pt-br.mdx',
    sourceFile: (path) => !/-(spanish|german|french|japanese|korean|chinese|keys)\.ts$/.test(path),
    traps:
      /para você mesmo|junto o pr|toque num botão|dono responde publicar|você toca|dono toca|pessoa toca|toca em (abrir|publicar)|seu toque|sua vez de tocar|um toque em|o toque em|esperar o toque/i,
  },
  {
    name: 'es',
    docsFolder: 'es',
    pageSuffix: 'page.es.mdx',
    sourceFile: (path) => path.endsWith('-spanish.ts'),
    traps:
      /ordenador|móvil|pulsas|vosotros|vuestr|por tu cuenta|usen las herramientas|para su persona|http en streaming|tú tocas|tu toque|un toque|el toque|ese toque|dueño toca|propietario toca|persona toca/i,
  },
  {
    name: 'de',
    docsFolder: 'de',
    pageSuffix: 'page.de.mdx',
    sourceFile: (path) => path.endsWith('-german.ts'),
    traps:
      /für dich selbst|besitzer|zugang öffnet|für deinen client|du tippst|dein(en)? tipp|ein tipp|das antippen|ein antippen|einem antippen|besitzer tippt|person tippt/i,
  },
  {
    name: 'fr',
    docsFolder: 'fr',
    pageSuffix: 'page.fr.mdx',
    sourceFile: (path) => path.endsWith('-french.ts'),
    traps:
      /par vous-même|http streamable|ouvre par vagues|pour sa personne|vous appuyez['.]|votre appui|un appui|d.un toucher|votre toucher|le toucher|un toucher|ce toucher|propriétaire appuie|personne touche/i,
  },
  {
    name: 'ja',
    docsFolder: 'ja',
    pageSuffix: 'page.ja.mdx',
    sourceFile: (path) => path.endsWith('-japanese.ts'),
    traps:
      /あなたのタップ|あなたがタップ|あなたはタップ|タップを待|タップが必要|のタップ(だけ|でも)|ワンタップ|タップで答える|へのタップ|でのタップ/,
  },
  {
    name: 'ko',
    docsFolder: 'ko',
    pageSuffix: 'page.ko.mdx',
    sourceFile: (path) => path.endsWith('-korean.ts') && !/legal-copy|backoffice-copy/.test(path),
    traps:
      /[가-힣]니다|[가-힣]니까|직접 설정하세요|직접 설정하기|스트리머블|주인이|자신의 사용자|내 탭|내가 탭|나는 탭|탭을 기다|탭으로 답|탭이 |탭 필요|그 뒤의 탭|한 번 탭|탭한 것|그 탭은/,
  },
  {
    name: 'zh',
    docsFolder: 'zh',
    pageSuffix: 'page.zh.mdx',
    sourceFile: (path) => path.endsWith('-chinese.ts'),
    traps: /您|主人|自己设置|可流式传输|你来点选|点一下|点按作答|等你点按|你点按|需要你点|点按钮才算数|可点按/,
  },
];

function filesUnder({ root, accepts }: { root: string; accepts: (path: string) => boolean }): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (entry === 'node_modules') return [];
    if (statSync(path).isDirectory()) return filesUnder({ root: path, accepts });
    return accepts(path) ? [path] : [];
  });
}

function filesWithTraps({ paths, traps }: { paths: string[]; traps: RegExp }): string[] {
  return paths.filter((path) => traps.test(readFileSync(path, 'utf8')));
}

describe('literal translations of tap and click that must not come back', () => {
  it.each(LANGUAGES)('keeps $name docs free of the traps', ({ docsFolder, traps }) => {
    const pages = filesUnder({ root: join(DOCS_ROOT, docsFolder), accepts: (path) => path.endsWith('.mdx') });
    expect(pages.length).toBeGreaterThan(0);
    expect(filesWithTraps({ paths: pages, traps })).toEqual([]);
  });

  it.each(LANGUAGES)('keeps $name agent page sources free of the traps', ({ pageSuffix, traps }) => {
    const pages = filesUnder({ root: AGENTS_ROOT, accepts: (path) => path.endsWith(pageSuffix) });
    expect(pages.length).toBeGreaterThan(0);
    expect(filesWithTraps({ paths: pages, traps })).toEqual([]);
  });

  it.each(LANGUAGES)('keeps $name copy modules free of the traps', ({ sourceFile, traps }) => {
    const modules = filesUnder({
      root: SOURCE_ROOT,
      accepts: (path) => COPY_FILE_PATTERN.test(path) && sourceFile(path),
    });
    expect(modules.length).toBeGreaterThan(0);
    expect(filesWithTraps({ paths: modules, traps })).toEqual([]);
  });
});
