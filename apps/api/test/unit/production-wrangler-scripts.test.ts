import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT_PACKAGE_PATH = '../../package.json';
const PRODUCTION_WRANGLER_FLAG = '--env production';

type RootPackage = { scripts: Record<string, string> };

const rootPackage: RootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_PATH, 'utf8'));

describe('root scripts', () => {
  it('never pass the production environment flag to wrangler, because production is the top-level block', () => {
    const offenders = Object.entries(rootPackage.scripts)
      .filter(([, command]) => command.includes(PRODUCTION_WRANGLER_FLAG))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });
});
