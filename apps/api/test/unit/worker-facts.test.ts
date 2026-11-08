import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { MAX_FUTURE_SKEW_MS } from '../../src/adapters/whatsapp/whatsapp-constants';
import type { Bindings } from '../../src/contract/env';
import { inspectWorker, WORKER_ENTRY_FILE } from '../../src/operations/worker-facts';

const WORKER_SOURCE_ROOT = join(import.meta.dirname, '../../src');

const ENTRY_WITH_SCHEDULED = 'export default { fetch: () => new Response(), scheduled: async () => undefined };';
const ENTRY_WITHOUT_SCHEDULED = 'export default { fetch: () => new Response() };';

const sourceRoots: string[] = [];

async function sourceRootWith(input: { entry: string }): Promise<string> {
  const sourceRoot = await mkdtemp(join(tmpdir(), 'zapbip-worker-facts-'));
  sourceRoots.push(sourceRoot);
  await writeFile(join(sourceRoot, WORKER_ENTRY_FILE), input.entry);
  return sourceRoot;
}

function appWithInstallRoute(): Hono<{ Bindings: Bindings }> {
  return new Hono<{ Bindings: Bindings }>().get(`${INSTALL_PAGE_PATH_PREFIX}:installCode`, (context) => context.text('instructions'));
}

function appWithoutInstallRoute(): Hono {
  return new Hono().get('/health', (context) => context.json({ ok: true }));
}

afterEach(async () => {
  await Promise.all(sourceRoots.splice(0).map((sourceRoot) => rm(sourceRoot, { recursive: true })));
});

describe('worker facts', () => {
  it('finds the scheduled export and the install route of the built app', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED });
    expect(await inspectWorker({ sourceRoot, app: appWithInstallRoute() })).toEqual({ exportsScheduled: true, mountsInstallRoute: true });
  });

  it('reports a missing scheduled export', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITHOUT_SCHEDULED });
    expect(await inspectWorker({ sourceRoot, app: appWithInstallRoute() })).toEqual({ exportsScheduled: false, mountsInstallRoute: true });
  });

  it('reports a missing install route', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED });
    expect(await inspectWorker({ sourceRoot, app: appWithoutInstallRoute() })).toEqual({
      exportsScheduled: true,
      mountsInstallRoute: false,
    });
  });

  it('is not fooled by the install path appearing in a string or another method', async () => {
    const sourceRoot = await sourceRootWith({ entry: `${ENTRY_WITH_SCHEDULED} // ${INSTALL_PAGE_PATH_PREFIX}:installCode` });
    const app = new Hono().post(`${INSTALL_PAGE_PATH_PREFIX}:installCode`, (context) => context.text('no'));
    expect((await inspectWorker({ sourceRoot, app })).mountsInstallRoute).toBe(false);
  });

  it('reads the routes of the real built app, so a route mounted later is seen without a text match', async () => {
    const sourceRoot = await sourceRootWith({ entry: ENTRY_WITH_SCHEDULED });
    const app = createApp({ extraRoutes: [appWithInstallRoute()], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS });
    expect((await inspectWorker({ sourceRoot, app })).mountsInstallRoute).toBe(true);
  });

  it('sees the install route of the app built as the deploy builds it, from the real source root', async () => {
    const app = createApp({ extraRoutes: [], developmentMediaOrigin: null, maxFutureSkewMs: MAX_FUTURE_SKEW_MS });
    expect(await inspectWorker({ sourceRoot: WORKER_SOURCE_ROOT, app })).toEqual({ exportsScheduled: true, mountsInstallRoute: true });
  });
});
