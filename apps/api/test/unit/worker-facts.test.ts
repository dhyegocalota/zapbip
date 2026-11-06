import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { INSTALL_ROUTE_PATH, inspectWorkerSource, WORKER_ENTRY_FILE } from '../../src/operations/worker-facts';

const ENTRY_WITH_SCHEDULED = 'export default { fetch: () => new Response(), scheduled: async () => undefined };';
const ENTRY_WITHOUT_SCHEDULED = 'export default { fetch: () => new Response() };';
const ROUTES_WITH_INSTALL = `app.get('${INSTALL_ROUTE_PATH}', (context) => context.text('instructions'));`;
const ROUTES_WITHOUT_INSTALL = "app.get('/health', (context) => context.json({ ok: true }));";

const sourceRoots: string[] = [];

async function sourceRootWith(input: { entry: string; routes: string }): Promise<string> {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'zapbip-worker-facts-'));
  sourceRoots.push(sourceRoot);
  await mkdir(join(sourceRoot, 'routes'));
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
});
