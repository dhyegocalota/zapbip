import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';
import type { Env, Hono } from 'hono';
import { inspectRoutes } from 'hono/dev';
import { METHOD_NAME_ALL } from 'hono/router';
import type { WorkerFacts } from './deploy-preflight';

export const INSTALL_ROUTE_PATH = `${INSTALL_PAGE_PATH_PREFIX}:installCode`;
export const WORKER_ENTRY_FILE = 'index.ts';

const SCHEDULED_EXPORT_PATTERN = /\bscheduled\s*[:(]/;
const GET_METHOD = 'GET';
const GET_SERVING_METHODS: readonly string[] = [GET_METHOD, METHOD_NAME_ALL];

export type WorkerApp<AppEnv extends Env = Env> = Hono<AppEnv>;

export async function inspectWorker<AppEnv extends Env>(input: { sourceRoot: string; app: WorkerApp<AppEnv> }): Promise<WorkerFacts> {
  const entry = await readFile(join(input.sourceRoot, WORKER_ENTRY_FILE), 'utf8');
  return {
    exportsScheduled: SCHEDULED_EXPORT_PATTERN.test(entry),
    mountsInstallRoute: inspectRoutes(input.app).some(
      (route) => !route.isMiddleware && GET_SERVING_METHODS.includes(route.method) && route.path.startsWith(INSTALL_PAGE_PATH_PREFIX),
    ),
  };
}
