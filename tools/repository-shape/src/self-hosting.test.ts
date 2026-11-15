import { statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DOCS_LANGUAGE_FOLDERS, DocsPageLanguage } from '@zapbip/types';
import { DOCS_ROOT, PAGE_EXTENSION, readRepositoryFile, repositoryPath } from './repository-files';

const DOCKERFILE = 'Dockerfile';
const COMPOSE_FILE = 'compose.yaml';
const ENTRYPOINT = 'scripts/docker-entrypoint.sh';
const DOCKER_IGNORE = '.dockerignore';
const WORKER_PORT = '8787';
const DATA_VOLUME = 'zapbip-data';
const DATA_DIRECTORY = '/data';
const OPEN_SOURCE_PAGES = ['self-hosting', 'run-locally', 'deploy', 'license'];
const EXECUTABLE_BITS = 0o111;
const GENERATED_SECRETS = ['MEDIA_LINK_SIGNING_KEY', 'UPLOAD_LINK_SIGNING_KEY', 'NUMBER_REGISTRY_KEY', 'META_APP_SECRET'];
const LANGUAGES = Object.values(DocsPageLanguage);

function pageOf({ page, language }: { page: string; language: DocsPageLanguage }): string {
  const folder = DOCS_LANGUAGE_FOLDERS[language];
  const prefix = folder === '' ? '' : `${folder}/`;
  return readRepositoryFile(`${DOCS_ROOT}/${prefix}open-source/${page}${PAGE_EXTENSION}`);
}

describe('self-hosting', () => {
  test('the container files exist and the entrypoint is executable', () => {
    [DOCKERFILE, COMPOSE_FILE, DOCKER_IGNORE, ENTRYPOINT].forEach((path) => expect(statSync(repositoryPath(path)).isFile()).toBe(true));
    expect(statSync(repositoryPath(ENTRYPOINT)).mode & EXECUTABLE_BITS).toBeGreaterThan(0);
  });

  test('the image, the Compose file and the entrypoint agree on the port, the volume and the data directory', () => {
    expect(readRepositoryFile(DOCKERFILE)).toContain(`EXPOSE ${WORKER_PORT}`);
    expect(readRepositoryFile(DOCKERFILE)).toContain(`ZAPBIP_DATA_DIRECTORY=${DATA_DIRECTORY}`);
    expect(readRepositoryFile(COMPOSE_FILE)).toContain(`${WORKER_PORT}:${WORKER_PORT}`);
    expect(readRepositoryFile(COMPOSE_FILE)).toContain(`${DATA_VOLUME}:${DATA_DIRECTORY}`);
    expect(readRepositoryFile(ENTRYPOINT)).toContain(`--port ${WORKER_PORT}`);
  });

  test('the entrypoint keeps every secret the development sandbox needs, and Compose passes each one through', () => {
    GENERATED_SECRETS.forEach((secret) => {
      expect(readRepositoryFile(ENTRYPOINT)).toContain(`secret_of ${secret} `);
      expect(readRepositoryFile(COMPOSE_FILE)).toContain(`${secret}:`);
    });
  });

  test('the docker context leaves out secrets and local state', () => {
    ['.git', '**/node_modules', '**/.dev.vars', '.env'].forEach((entry) =>
      expect(readRepositoryFile(DOCKER_IGNORE).split('\n')).toContain(entry),
    );
  });

  test.each(LANGUAGES)('the %s open source pages exist', (language) => {
    OPEN_SOURCE_PAGES.forEach((page) => expect(pageOf({ page, language }).length).toBeGreaterThan(0));
  });

  test.each(LANGUAGES)('the %s local page names the volume, the port and the compose command', (language) => {
    const page = pageOf({ page: 'run-locally', language });
    expect(page).toContain(DATA_VOLUME);
    expect(page).toContain(WORKER_PORT);
    expect(page).toContain('docker compose up --build');
  });
});
