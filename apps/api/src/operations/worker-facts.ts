import type { WorkerFacts } from './deploy-preflight';

export const INSTALL_ROUTE_PATH = '/i/:installCode';
export const WORKER_ENTRY_FILE = 'index.ts';

export function inspectWorkerSource(input: { sourceRoot: string }): Promise<WorkerFacts> {
  void input;
  throw new Error('inspectWorkerSource is not implemented');
}
