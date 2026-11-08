import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryPath } from './repository-files';

const WORKFLOW_FILE = '.github/workflows/verify.yml';
const JOB_LINE_PATTERN = /^ {2}[\w-]+:$/;
const JOB_INDENT_LENGTH = 2;
const NEXT_JOB_PATTERN = /\n {2}\S[^\n]*:\n/;
const EXPECTED_JOBS = ['checks', 'unit', 'security'];
const CHECKS_JOB = 'checks';
const CHECKS_STEPS = [
  'run: pnpm format:check',
  'run: pnpm typecheck',
  'run: pnpm test:hooks',
  'run: pnpm test:verify',
  'run: .agents/hooks/doctor.sh',
];
const SECURITY_JOB = 'security';
const SECURITY_STEPS = [
  'run: pnpm security:audit',
  'sha256sum --check --strict',
  'run: .github/scripts/secret-rules-probe.sh ./gitleaks',
  'run: ./gitleaks git --no-banner --redact --exit-code 1 .',
  'run: ./gitleaks dir --no-banner --redact --exit-code 1 .',
];
const TREE_SCAN_STEP = 'run: ./gitleaks dir --no-banner --redact --exit-code 1 .';
const FULL_HISTORY_CHECKOUT = 'fetch-depth: 0';
const UNIT_JOB = 'unit';
const INSTALL_ACTION = 'uses: ./.github/actions/install';
const NEEDS_KEY = 'needs:';
const TIMEOUT_PATTERN = /timeout-minutes: (\d+)/;
const MAXIMUM_TIMEOUT_MINUTES = 20;
const WORKFLOW_PERMISSIONS = '\npermissions:\n  contents: read\n';
const JOBS_START = '\njobs:\n';
const LINE_SEPARATOR = '\n';
const UNIT_MATRIX_ENTRIES = ['{ name: repository-shape, filter: "@zapbip/repository-shape" }'];
const UNIT_FILTER_STEP = 'run: pnpm --filter "$FILTER" test:unit';
const UNIT_FILTER_ENVIRONMENT = 'FILTER: ${{ matrix.filter }}';
const FAIL_FAST_DISABLED = 'fail-fast: false';
const TOKEN_REFERENCE = 'secrets.';
const WORKFLOWS_DIRECTORY = '.github/workflows';
const ACTIONS_DIRECTORY = '.github/actions';
const YAML_EXTENSION = '.yml';
const EXTERNAL_ACTION_PATTERN = /^\s*-?\s*uses: (?!\.\/)(\S+)(.*)$/gm;
const PINNED_ACTION_PATTERN = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const VERSION_COMMENT_PATTERN = /^ # v\d[\w.-]*$/;

function yamlFiles(directory: string): string[] {
  if (!existsSync(repositoryPath(directory))) return [];
  return readdirSync(repositoryPath(directory), { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) return yamlFiles(path);
    return entry.name.endsWith(YAML_EXTENSION) ? [path] : [];
  });
}

function job(name: string): string {
  const workflow = readRepositoryFile(WORKFLOW_FILE);
  const jobStart = `\n  ${name}:\n`;
  const start = workflow.indexOf(jobStart);
  if (start === -1) throw new Error(`${WORKFLOW_FILE} has no ${name} job`);
  const rest = workflow.slice(start + jobStart.length);
  const next = rest.search(NEXT_JOB_PATTERN);
  return next === -1 ? rest : rest.slice(0, next);
}

function jobNames(): string[] {
  const workflow = readRepositoryFile(WORKFLOW_FILE);
  const jobs = workflow.slice(workflow.indexOf(JOBS_START));
  return jobs
    .split(LINE_SEPARATOR)
    .filter((line) => JOB_LINE_PATTERN.test(line))
    .map((line) => line.slice(JOB_INDENT_LENGTH, -1));
}

describe('CI workflow', () => {
  test('the workflow grants the token read access to the contents only', () => {
    const workflow = readRepositoryFile(WORKFLOW_FILE);
    expect(workflow).toContain(WORKFLOW_PERMISSIONS);
    expect(workflow.indexOf(WORKFLOW_PERMISSIONS)).toBeLessThan(workflow.indexOf(JOBS_START));
  });

  test('the workflow runs exactly the checks, unit and security jobs', () => {
    expect(jobNames()).toEqual(EXPECTED_JOBS);
  });

  test('the checks job checks the formatting, typechecks, tests the hooks and the gate script and runs the machine doctor script', () => {
    const checks = job(CHECKS_JOB);
    expect(CHECKS_STEPS.filter((step) => !checks.includes(step))).toEqual([]);
  });

  test('the security job audits production dependencies and scans the full history for secrets without a token', () => {
    const security = job(SECURITY_JOB);
    expect(SECURITY_STEPS.filter((step) => !security.includes(step))).toEqual([]);
    expect(security).toContain(FULL_HISTORY_CHECKOUT);
    expect(security).not.toContain(TOKEN_REFERENCE);
  });

  test('the security job scans the tree before the dependencies are installed', () => {
    const security = job(SECURITY_JOB);
    expect(security.indexOf(TREE_SCAN_STEP)).toBeLessThan(security.indexOf(INSTALL_ACTION));
  });

  test('no job waits for another job', () => {
    expect(readRepositoryFile(WORKFLOW_FILE)).not.toContain(NEEDS_KEY);
  });

  test('every job installs through the composite action', () => {
    expect(EXPECTED_JOBS.filter((name) => !job(name).includes(INSTALL_ACTION))).toEqual([]);
  });

  test('the unit matrix lists the repository-shape package', () => {
    const unit = job(UNIT_JOB);
    expect(UNIT_MATRIX_ENTRIES.filter((entry) => !unit.includes(entry))).toEqual([]);
  });

  test('the unit step filters by the matrix filter through the environment, never inline', () => {
    expect(job(UNIT_JOB)).toContain(UNIT_FILTER_STEP);
    expect(job(UNIT_JOB)).toContain(UNIT_FILTER_ENVIRONMENT);
    expect(job(UNIT_JOB)).not.toMatch(/run:[^\n]*\$\{\{ matrix/);
  });

  test('the unit job checks out the full history, which the feature status check reads', () => {
    expect(job(UNIT_JOB)).toContain(FULL_HISTORY_CHECKOUT);
  });

  test('a failing unit matrix entry does not cancel the others', () => {
    expect(job(UNIT_JOB)).toContain(FAIL_FAST_DISABLED);
  });

  test('every job has a bounded timeout', () => {
    const unbounded = EXPECTED_JOBS.filter((name) => {
      const match = TIMEOUT_PATTERN.exec(job(name));
      return match === null || Number(match[1]) > MAXIMUM_TIMEOUT_MINUTES;
    });
    expect(unbounded).toEqual([]);
  });

  test('every external action is pinned to a full commit hash with its version tag as a trailing comment', () => {
    const unpinned = [...yamlFiles(WORKFLOWS_DIRECTORY), ...yamlFiles(ACTIONS_DIRECTORY)].flatMap((file) =>
      [...readRepositoryFile(file).matchAll(EXTERNAL_ACTION_PATTERN)]
        .filter(([, action, trailer]) => !PINNED_ACTION_PATTERN.test(action!) || !VERSION_COMMENT_PATTERN.test(trailer!))
        .map(([, action]) => `${file}: ${action}`),
    );
    expect(unpinned).toEqual([]);
  });
});
