import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';
import { METHOD_NAME_ALL } from 'hono/router';
import type { WorkerFacts } from './deploy-preflight';

export const INSTALL_ROUTE_PATH = `${INSTALL_PAGE_PATH_PREFIX}:installCode`;
export const WORKER_ENTRY_FILE = 'index.ts';

const SCHEDULED_EXPORT_PATTERN = /\bscheduled\s*[:(]/;
const GET_METHOD = 'GET';
const GET_SERVING_METHODS: readonly string[] = [GET_METHOD, METHOD_NAME_ALL];

export type WorkerApp = { routes: readonly { method: string; path: string }[] };

export async function inspectWorker(input: { sourceRoot: string; app: WorkerApp }): Promise<WorkerFacts> {
  const entry = await readFile(join(input.sourceRoot, WORKER_ENTRY_FILE), 'utf8');
  return {
    exportsScheduled: SCHEDULED_EXPORT_PATTERN.test(entry),
    mountsInstallRoute: input.app.routes.some(
      (route) => GET_SERVING_METHODS.includes(route.method) && route.path.startsWith(INSTALL_PAGE_PATH_PREFIX),
    ),
  };
}
