import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const PACKAGE_DIRECTORY = new URL('../../', import.meta.url);
const SDK_SPECIFIER = 'openclaw/plugin-sdk';
const BUILD_TIMEOUT_MS = 60_000;
const REQUIRE_SHIM = 'const require = createRequire(import.meta.url);';

let bundle = '';

beforeAll(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: PACKAGE_DIRECTORY, stdio: 'ignore' });
  bundle = readFileSync(new URL('dist/index.js', PACKAGE_DIRECTORY), 'utf8');
}, BUILD_TIMEOUT_MS);

describe('bundle', () => {
  it('keeps the SDK external, only in import statements', () => {
    const sdkLines = bundle.split('\n').filter((line) => line.includes(SDK_SPECIFIER));
    expect(sdkLines.length).toBeGreaterThan(0);
    expect(sdkLines.every((line) => line.startsWith('import '))).toBe(true);
  });

  it('defines require before the bundled CommonJS code can ask for a Node module', () => {
    const shimIndex = bundle.indexOf(REQUIRE_SHIM);
    expect(shimIndex).toBeGreaterThanOrEqual(0);
    expect(shimIndex).toBeLessThan(bundle.indexOf('__require("http")'));
  });

  it('builds the bundle before every publish', () => {
    const manifest = JSON.parse(readFileSync(new URL('package.json', PACKAGE_DIRECTORY), 'utf8')) as { scripts: Record<string, string> };
    expect(manifest.scripts.prepublishOnly).toBe('pnpm run build');
  });

  it('carries no secret literal', () => {
    expect(bundle).not.toContain('zb_conn_');
    expect(bundle).not.toContain('ZAPBIP_CONNECTION_URL');
  });
});
