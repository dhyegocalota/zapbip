import type { TestProject } from 'vitest/node';
import setup, { type StackContext } from './global-setup';

export type IsolatedStack = { context: StackContext; stop: () => Promise<void> };

export async function startIsolatedStack(): Promise<IsolatedStack> {
  const provided: StackContext[] = [];
  const project = { provide: (_key: string, value: StackContext) => provided.push(value) } as unknown as TestProject;
  const stop = await setup(project);
  const [context] = provided;
  if (!context) throw new Error('the isolated stack was not provided');
  return { context, stop };
}
