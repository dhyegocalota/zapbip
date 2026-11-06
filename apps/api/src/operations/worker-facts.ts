import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkerFacts } from './deploy-preflight';

export const INSTALL_ROUTE_PATH = '/i/:installCode';
export const WORKER_ENTRY_FILE = 'index.ts';

const SCHEDULED_EXPORT_PATTERN = /\bscheduled\s*[:(]/;
const SOURCE_EXTENSION = '.ts';

export async function inspectWorkerSource(input: { sourceRoot: string }): Promise<WorkerFacts> {
  const { sourceRoot } = input;
  const entry = await readFile(join(sourceRoot, WORKER_ENTRY_FILE), 'utf8');
  const sourceFiles = (await readdir(sourceRoot, { recursive: true })).filter((file) => file.endsWith(SOURCE_EXTENSION));
  const sources = await Promise.all(sourceFiles.map((file) => readFile(join(sourceRoot, file), 'utf8')));
  return {
    exportsScheduled: SCHEDULED_EXPORT_PATTERN.test(entry),
    mountsInstallRoute: sources.some((source) => source.includes(INSTALL_ROUTE_PATH)),
  };
}
