import { readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DOCS_ROOT, PAGE_EXTENSION, readRepositoryFile, repositoryPath } from './repository-files';

const PORTUGUESE_ROOT = `${DOCS_ROOT}/pt-br`;
const RETIRED_RUNG_LABELS = /\breserva\b(?! um envio)|só a caixa|despertar agendado/i;

function portuguesePages(): string[] {
  return readdirSync(repositoryPath(PORTUGUESE_ROOT), { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith(PAGE_EXTENSION))
    .map((path) => posix.join(PORTUGUESE_ROOT, path));
}

describe('pt-BR docs rung labels', () => {
  test.each(portuguesePages())('%s never uses a retired rung label', (page) => {
    expect(readRepositoryFile(page)).not.toMatch(RETIRED_RUNG_LABELS);
  });
});
