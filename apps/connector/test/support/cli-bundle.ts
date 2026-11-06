import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const CLI_ENTRY = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

export const CONNECTION_URL_VARIABLE = 'ZAPBIP_CONNECTION_URL';
export const DISABLE_TLS_VERIFICATION_ENVIRONMENT = { NODE_TLS_REJECT_UNAUTHORIZED: '0' };

export async function buildCliBundle(): Promise<{ bundleFile: string; cleanup: () => Promise<void> }> {
  const bundleDirectory = await mkdtemp(join(tmpdir(), 'zapbip-cli-bundle-'));
  const bundleFile = join(bundleDirectory, 'cli.mjs');
  await build({
    entryPoints: [CLI_ENTRY],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    outfile: bundleFile,
    logLevel: 'silent',
  });
  return { bundleFile, cleanup: () => rm(bundleDirectory, { recursive: true, force: true }) };
}
