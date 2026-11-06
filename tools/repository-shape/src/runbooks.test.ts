import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { capturedNames, readRepositoryFile, repositoryPath } from './repository-files';

const RUNBOOKS_DIRECTORY = 'docs/runbooks';
const INDEX_FILE_NAME = 'README.md';
const DEPLOY_RUNBOOK = 'deploy.md';
const DOCS_APPLICATION_DIRECTORY = 'apps/docs';
const RUNBOOKS_REFERENCE = 'runbooks';
const MARKDOWN_EXTENSION = '.md';
const ROOT_PACKAGE_FILE = 'package.json';
const NODE_MODULES_DIRECTORY = 'node_modules';
const FIRST_STEP_NUMBER = 1;
const ANCHOR_SEPARATOR = '#';
const PUBLISH_STEP_TITLE = 'Publish the docs';
const GO_LIVE_ORDER = [
  'Prepare your machine',
  'Cloudflare setup',
  'DNS',
  'Meta setup',
  'Meta templates approved',
  'Resources and secrets',
  'Migrate and deploy staging',
  'Smoke staging',
  'Rollback rehearsal',
  'Publish the packages',
  'Company facts and official number',
  'Publish the docs',
  'Meta live mode',
  'Production deploy',
  'Smoke production',
];
const PNPM_BUILT_IN_COMMANDS = ['exec', 'dlx', 'install', 'add'];
const TITLE_PATTERN = /^# .+\n\n(.+)\n/;
const STEP_PATTERN = /^(\d+)\. (.*)$/gm;
const STEP_TITLE_PATTERN = /^\*\*(.+?)\.?\*\*/;
const FAILURE_LINE_PATTERN = /^ {3,4}If it fails: .+$/m;
const LINK_PATTERN = /\]\(([^)\s]+)\)/g;
const EXTERNAL_LINK_PATTERN = /^(https?:|mailto:|#)/;
const PNPM_COMMAND_PATTERN = /\bpnpm ([a-z][\w:-]*)/g;
const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;
const IMMUTABLE_MIGRATION_PATTERN = /migration[^.]*is never edited/i;

type Runbook = { file: string; text: string };

function runbookFiles(): string[] {
  return readdirSync(repositoryPath(RUNBOOKS_DIRECTORY)).filter((file) => file.endsWith(MARKDOWN_EXTENSION));
}

function readRunbook(file: string): Runbook {
  return { file, text: readRepositoryFile(posix.join(RUNBOOKS_DIRECTORY, file)) };
}

function allRunbooks(): Runbook[] {
  return runbookFiles().map(readRunbook);
}

function stepSections(text: string): { number: number; title: string; body: string }[] {
  const steps = [...text.matchAll(STEP_PATTERN)];
  return steps.map((match, index) => {
    const next = steps[index + 1];
    return { number: Number(match[1]), title: match[2]!, body: text.slice(match.index, next ? next.index : undefined) };
  });
}

function stepTitleOf(title: string): string {
  const match = STEP_TITLE_PATTERN.exec(title);
  if (!match) throw new Error(`step without a bold title: ${title}`);
  return match[1]!;
}

function shapeViolations({ file, text }: Runbook): string[] {
  const purpose = TITLE_PATTERN.exec(text);
  const hasPurpose = purpose !== null && purpose[1]!.endsWith('.');
  const missingPurpose = hasPurpose ? [] : [`${file}: no purpose sentence after the title`];
  const steps = stepSections(text);
  const noSteps = steps.length === 0 ? [`${file}: no numbered steps`] : [];
  const gaps = steps
    .filter((step, index) => step.number !== index + FIRST_STEP_NUMBER)
    .map((step) => `${file}: step ${step.number} is out of sequence`);
  const missingFailureLine = steps
    .filter((step) => !FAILURE_LINE_PATTERN.test(step.body))
    .map((step) => `${file}: step ${step.number} has no If it fails line`);
  return [...missingPurpose, ...noSteps, ...gaps, ...missingFailureLine];
}

function isBrokenLink({ file, target }: { file: string; target: string }): boolean {
  const path = target.split(ANCHOR_SEPARATOR, 1).join('');
  return !existsSync(repositoryPath(posix.join(RUNBOOKS_DIRECTORY, posix.dirname(file), path)));
}

function brokenLinks({ file, text }: Runbook): string[] {
  return capturedNames({ text: text.replace(FENCED_BLOCK_PATTERN, ''), pattern: LINK_PATTERN })
    .filter((target) => !EXTERNAL_LINK_PATTERN.test(target))
    .filter((target) => isBrokenLink({ file, target }))
    .map((target) => `${file}: ${target}`);
}

function rootScripts(): string[] {
  return Object.keys(JSON.parse(readRepositoryFile(ROOT_PACKAGE_FILE)).scripts);
}

function unknownCommands({ file, text }: Runbook): string[] {
  const scripts = rootScripts();
  return capturedNames({ text, pattern: PNPM_COMMAND_PATTERN })
    .filter((command) => !PNPM_BUILT_IN_COMMANDS.includes(command))
    .filter((command) => !scripts.includes(command))
    .map((command) => `${file}: pnpm ${command}`);
}

function filesUnder(directory: string): string[] {
  return readdirSync(repositoryPath(directory), { withFileTypes: true })
    .filter((entry) => entry.name !== NODE_MODULES_DIRECTORY)
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(posix.join(directory, entry.name)) : [posix.join(directory, entry.name)]));
}

function readmeStepTitles(): string[] {
  return stepSections(readRunbook(INDEX_FILE_NAME).text).map((step) => stepTitleOf(step.title));
}

describe('runbooks', () => {
  test('the index links every other runbook exactly once', () => {
    const index = readRunbook(INDEX_FILE_NAME).text;
    const linkCounts = runbookFiles()
      .filter((file) => file !== INDEX_FILE_NAME)
      .map((file) => ({ file, count: index.split(`](${file})`).length - 1 }));
    expect(linkCounts.filter((entry) => entry.count !== 1)).toEqual([]);
  });

  test('every relative link resolves to a file', () => {
    expect(allRunbooks().flatMap(brokenLinks)).toEqual([]);
  });

  test('every runbook has a purpose sentence, numbered steps and an If it fails line per step', () => {
    expect(allRunbooks().flatMap(shapeViolations)).toEqual([]);
  });

  test('a runbook with only a title is reported by name', () => {
    expect(shapeViolations({ file: 'empty.md', text: '# Empty\n' })).toEqual([
      'empty.md: no purpose sentence after the title',
      'empty.md: no numbered steps',
    ]);
  });

  test('a step without its failure line is reported by number', () => {
    const text = '# Title\n\nPurpose.\n\n1. **One.** Do it.\n   If it fails: stop.\n2. **Two.** Do it.\n';
    expect(shapeViolations({ file: 'gap.md', text })).toEqual(['gap.md: step 2 has no If it fails line']);
  });

  test('deploy.md states that a deployed migration is never edited', () => {
    expect(readRunbook(DEPLOY_RUNBOOK).text).toMatch(IMMUTABLE_MIGRATION_PATTERN);
  });

  test('no file of the Mintlify site points at the runbooks', () => {
    const pointing = filesUnder(DOCS_APPLICATION_DIRECTORY).filter((path) => readRepositoryFile(path).includes(RUNBOOKS_REFERENCE));
    expect(pointing).toEqual([]);
  });

  test('the index lists the go-live steps in order, with the docs publish after DNS', () => {
    const titles = readmeStepTitles();
    expect(titles.slice(0, GO_LIVE_ORDER.length)).toEqual(GO_LIVE_ORDER);
    expect(titles.indexOf(PUBLISH_STEP_TITLE)).toBeGreaterThan(titles.indexOf('DNS'));
  });

  test('deploy.md documents the first deploy flag and no longer the pending secret trick', () => {
    const text = readRunbook(DEPLOY_RUNBOOK).text;
    expect(text).toContain('--first-deploy');
    expect(text).not.toContain('`pending`');
    expect(text).not.toContain('the word `pending`');
  });

  test('no runbook types a Worker name after wrangler tail', () => {
    expect(
      allRunbooks()
        .filter(({ text }) => /wrangler tail zapbip/.test(text))
        .map(({ file }) => file),
    ).toEqual([]);
  });

  test('the docs publish runbook points at the docs preflight script', () => {
    expect(readRunbook('mintlify-publish.md').text).toContain('pnpm docs:preflight');
  });

  test('every pnpm command in a runbook is a root script or a pnpm built-in', () => {
    expect(allRunbooks().flatMap(unknownCommands)).toEqual([]);
  });
});
