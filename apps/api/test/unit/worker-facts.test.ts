import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { INSTALL_ROUTE_PATH, inspectWorkerSource, WORKER_ENTRY_FILE } from '../../src/operations/worker-facts';

const ENTRY_WITH_SCHEDULED = 'export default { fetch: () => new Response(), scheduled: async () => undefined };';
const ENTRY_WITHOUT_SCHEDULED = 'export default { fetch: () => new Response() };';
const ROUTES_WITH_INSTALL = `app.get('${INSTALL_ROUTE_PATH}', (context) => context.text('instructions'));`;
const ROUTES_WITHOUT_INSTALL = "app.get('/health', (context) => context.json({ ok: true }));";

const sourceRoots: string[] = [];

async function sourceRootWith(input: { entry: string; routes: string; app?: string }): Promise<string> {
  const { app = '' } = input;
  const sourceRoot = await mkdtemp(join(tmpdir(), 'zapbip-worker-facts-'));
  sourceRoots.push(sourceRoot);
  await mkdir(join(sourceRoot, 'routes'));
  await mkdir(join(sourceRoot, 'operations'));
  await writeFile(join(sourceRoot, 'app.ts'), app);
  await writeFile(join(sourceRoot, 'operations', 'worker-facts.ts'), `export const INSTALL_ROUTE_PATH = '${INSTALL_ROUTE_PATH}';`);
  await writeFile(join(sourceRoot, WORKER_ENTRY_FILE), input.entry);
  await writeFile(join(sourceRoot, 'routes', 'install.ts'), input.routes);
  return sourceRoot;
}

afterEach(async () => {
  await Promise.all(sourceRoots.splice(0).map((sourceRoot) => rm(sourceRoot, { recursive: true })));
});

describe('worker facts', () => {
  it('finds the scheduled export and the install route', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED, routes: ROUTES_WITH_INSTALL });
    expect(await inspectWorkerSource({ sourceRoot })).toEqual({ exportsScheduled: true, mountsInstallRoute: true });
  });

  it('reports a missing scheduled export', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITHOUT_SCHEDULED, routes: ROUTES_WITH_INSTALL });
    expect(await inspectWorkerSource({ sourceRoot })).toEqual({ exportsScheduled: false, mountsInstallRoute: true });
  });

  it('reports a missing install route', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED, routes: ROUTES_WITHOUT_INSTALL });
    expect(await inspectWorkerSource({ sourceRoot })).toEqual({ exportsScheduled: true, mountsInstallRoute: false });
  });

  it('does not take the constant of the operations folder for a mounted route', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED, routes: ROUTES_WITHOUT_INSTALL });
    expect((await inspectWorkerSource({ sourceRoot })).mountsInstallRoute).toBe(false);
  });

  it('finds the install route mounted in app.ts', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED, routes: ROUTES_WITHOUT_INSTALL, app: ROUTES_WITH_INSTALL });
    expect((await inspectWorkerSource({ sourceRoot })).mountsInstallRoute).toBe(true);
  });

  it('reads the real source tree: the flag follows app.ts and routes only, never the operations folder', async () => {
    const sourceRoot = join(import.meta.dirname, '../../src');
    const routeFiles = (await readdir(join(sourceRoot, 'routes'), { recursive: true })).filter((file) => file.endsWith('.ts'));
    const sources = await Promise.all([
      readFile(join(sourceRoot, 'app.ts'), 'utf8'),
      ...routeFiles.map((file) => readFile(join(sourceRoot, 'routes', file), 'utf8')),
    ]);
    const expected = sources.some((source) => source.includes(INSTALL_ROUTE_PATH));
    expect((await inspectWorkerSource({ sourceRoot })).mountsInstallRoute).toBe(expected);
  });
});
