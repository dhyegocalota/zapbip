import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PACKAGE_MANIFEST, readRepositoryFile, repositoryFiles, workspacePackages } from './repository-files';

const VITEST_CONFIG_PATHSPEC = '*vitest*.config.*';
const PLAYWRIGHT_CONFIG_PATHSPEC = '*playwright*.config.*';
const NAMED_MILLISECONDS = '[A-Z][A-Z_]*_MS';
const VITEST_DEFAULT_CONFIG_PATTERN = /^vitest\.config\./;
const VITEST_COMMAND = 'vitest';
const EXPLICIT_CONFIG_FLAG = '--config';

const vitestConfigs = repositoryFiles(VITEST_CONFIG_PATHSPEC);
const playwrightConfigs = repositoryFiles(PLAYWRIGHT_CONFIG_PATHSPEC);

const playwrightTimeoutPatterns: Record<string, RegExp> = {
  timeout: new RegExp(`^\\s*timeout: ${NAMED_MILLISECONDS},`, 'm'),
  'expect.timeout': new RegExp(`expect: \\{\\s*timeout: ${NAMED_MILLISECONDS},`),
  'use.navigationTimeout': new RegExp(`navigationTimeout: ${NAMED_MILLISECONDS},`),
  'use.actionTimeout': new RegExp(`actionTimeout: ${NAMED_MILLISECONDS},`),
};

function runsVitestWithDefaultConfig(path: string): boolean {
  const manifest = JSON.parse(readRepositoryFile(posix.join(path, PACKAGE_MANIFEST)));
  if (!manifest.scripts) return false;
  const commands: string[] = Object.values(manifest.scripts);
  return commands.some((command) => command.includes(VITEST_COMMAND) && !command.includes(EXPLICIT_CONFIG_FLAG));
}

describe('the test timeouts', () => {
  test('the repository has Vitest configurations to check', () => {
    expect(vitestConfigs.length).toBeGreaterThan(0);
  });

  test.each(vitestConfigs)('%s sets testTimeout and hookTimeout as named millisecond constants', (path) => {
    const source = readRepositoryFile(path);
    expect(source).toMatch(new RegExp(`testTimeout: ${NAMED_MILLISECONDS},`));
    expect(source).toMatch(new RegExp(`hookTimeout: ${NAMED_MILLISECONDS},`));
  });

  test.each(workspacePackages().filter(runsVitestWithDefaultConfig))('%s has a default Vitest configuration file', (path) => {
    const configNames = vitestConfigs.filter((config) => posix.dirname(config) === path).map((config) => posix.basename(config));
    expect(configNames.some((name) => VITEST_DEFAULT_CONFIG_PATTERN.test(name))).toBe(true);
  });

  describe.each(playwrightConfigs)('%s', (path) => {
    test.each(Object.entries(playwrightTimeoutPatterns))('sets %s as a named millisecond constant', (_setting, pattern) => {
      expect(readRepositoryFile(path)).toMatch(pattern);
    });
  });
});
