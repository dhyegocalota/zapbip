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
  timeout: new RegExp(`^ {2}timeout: ${NAMED_MILLISECONDS},`, 'm'),
  'expect.timeout': new RegExp(`expect: \\{\\s*timeout: ${NAMED_MILLISECONDS}\\s*[,}]`),
  'use.navigationTimeout': new RegExp(`navigationTimeout: ${NAMED_MILLISECONDS},`),
  'use.actionTimeout': new RegExp(`actionTimeout: ${NAMED_MILLISECONDS},`),
};

const COMPLETE_PLAYWRIGHT_CONFIG = `export default defineConfig({
  timeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
  expect: { timeout: LOADED_MACHINE_EXPECT_TIMEOUT_MS },
  use: {
    navigationTimeout: LOADED_MACHINE_NAVIGATION_TIMEOUT_MS,
    actionTimeout: LOADED_MACHINE_ACTION_TIMEOUT_MS,
  },
});`;
const PLAYWRIGHT_CONFIG_WITHOUT_TOP_LEVEL_TIMEOUT = COMPLETE_PLAYWRIGHT_CONFIG.replace('  timeout: LOADED_MACHINE_TEST_TIMEOUT_MS,\n', '');

function missingPlaywrightSettings(source: string): string[] {
  return Object.entries(playwrightTimeoutPatterns)
    .filter(([, pattern]) => !pattern.test(source))
    .map(([setting]) => setting);
}

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

  test.each(playwrightConfigs)('%s sets every Playwright timeout as a named millisecond constant', (path) => {
    expect(missingPlaywrightSettings(readRepositoryFile(path))).toEqual([]);
  });

  test('a Playwright configuration with all four timeouts is complete', () => {
    expect(missingPlaywrightSettings(COMPLETE_PLAYWRIGHT_CONFIG)).toEqual([]);
  });

  test('a Playwright configuration with only expect.timeout lacks the top-level timeout', () => {
    expect(missingPlaywrightSettings(PLAYWRIGHT_CONFIG_WITHOUT_TOP_LEVEL_TIMEOUT)).toEqual(['timeout']);
  });
});
