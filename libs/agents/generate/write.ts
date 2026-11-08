import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GenerationPlan } from './plan';
import { repositoryPath } from './repository';

export enum GenerationMode {
  Write = 'write',
  Check = 'check',
}

const REGENERATE_HINT = 'run pnpm agents:generate';

function isMissing(input: { path: string }): boolean {
  return !existsSync(repositoryPath(input.path));
}

function isStale(input: { path: string; content: string }): boolean {
  return isMissing(input) || readFileSync(repositoryPath(input.path), 'utf8') !== input.content;
}

export function pendingDeletionsOf(input: { plan: GenerationPlan }): string[] {
  return input.plan.deletions.filter((path) => !isMissing({ path }));
}

export function staleWritesOf(input: { plan: GenerationPlan }): string[] {
  return input.plan.writes.filter((write) => isStale(write)).map((write) => write.path);
}

function problemsOf(input: { plan: GenerationPlan }): string[] {
  const staleLines = staleWritesOf(input).map((path) =>
    isMissing({ path }) ? `missing generated file ${path}: ${REGENERATE_HINT}` : `stale ${path}: ${REGENERATE_HINT}`,
  );
  const deletionLines = pendingDeletionsOf(input).map((path) => `pending deletion ${path}: ${REGENERATE_HINT}`);
  return [...staleLines, ...deletionLines];
}

function applyPlan(input: { plan: GenerationPlan }): string[] {
  const stalePaths = staleWritesOf(input);
  input.plan.writes
    .filter((write) => stalePaths.includes(write.path))
    .forEach((write) => {
      mkdirSync(dirname(repositoryPath(write.path)), { recursive: true });
      writeFileSync(repositoryPath(write.path), write.content);
    });
  const deletedPaths = pendingDeletionsOf(input);
  deletedPaths.forEach((path) => rmSync(repositoryPath(path)));
  return [...stalePaths, ...deletedPaths];
}

export function writePlan(input: { plan: GenerationPlan; mode: GenerationMode }): string[] {
  if (input.mode === GenerationMode.Check) return problemsOf(input);
  return applyPlan(input);
}
