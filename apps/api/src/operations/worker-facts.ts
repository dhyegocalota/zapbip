import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkerFacts } from './deploy-preflight';

export const INSTALL_ROUTE_PATH = '/i/:installCode';
export const WORKER_ENTRY_FILE = 'index.ts';

const APP_FILE = 'app.ts';
const ROUTES_FOLDER = 'routes';
const SCHEDULED_EXPORT_PATTERN = /\bscheduled\s*[:(]/;
const SOURCE_EXTENSION = '.ts';

export async function inspectWorkerSource(input: { sourceRoot: string }): Promise<WorkerFacts> {
  const { sourceRoot } = input;
  const entry = await readFile(join(sourceRoot, WORKER_ENTRY_FILE), 'utf8');
  const routeFiles = (await readdir(join(sourceRoot, ROUTES_FOLDER), { recursive: true })).filter((file) =>
    file.endsWith(SOURCE_EXTENSION),
  );
  const routeSources = await Promise.all([
    readFile(join(sourceRoot, APP_FILE), 'utf8'),
    ...routeFiles.map((file) => readFile(join(sourceRoot, ROUTES_FOLDER, file), 'utf8')),
  ]);
  return {
    exportsScheduled: SCHEDULED_EXPORT_PATTERN.test(entry),
    mountsInstallRoute: routeSources.some((source) => source.includes(INSTALL_ROUTE_PATH)),
  };
}

export type WorkerApp = { routes: readonly { method: string; path: string }[] };

export function inspectWorker(input: { sourceRoot: string; app: WorkerApp }): Promise<WorkerFacts> {
  void input;
  throw new Error('inspectWorker is not implemented');
}
