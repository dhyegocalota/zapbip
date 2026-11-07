import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CONTAINER_HOST } from './constants';

const runCommand = promisify(execFile);
const DOCKER = 'docker';
const HOST_GATEWAY_ENTRY = `${CONTAINER_HOST}:host-gateway`;
const STOP_TIMEOUT_SECONDS = '10';
const LOG_BUFFER_BYTES = 64 * 1024 * 1024;

export type Container = { name: string; logFiles: string[] };

export type ContainerOptions = {
  name: string;
  image: string;
  platform: string | null;
  environment: Record<string, string>;
  mounts: string[];
  command: string[];
  entrypoint: string | null;
  logFiles: string[];
};

function platformArguments(input: { platform: string | null }): string[] {
  if (input.platform === null) return [];
  return ['--platform', input.platform];
}

function entrypointArguments(input: { entrypoint: string | null }): string[] {
  if (input.entrypoint === null) return [];
  return ['--entrypoint', input.entrypoint];
}

export async function startContainer(input: ContainerOptions): Promise<Container> {
  const environmentArguments = Object.entries(input.environment).flatMap(([name, value]) => ['-e', `${name}=${value}`]);
  const mountArguments = input.mounts.flatMap((mount) => ['-v', mount]);
  await runCommand(DOCKER, [
    'run',
    '-d',
    '--name',
    input.name,
    '--add-host',
    HOST_GATEWAY_ENTRY,
    ...platformArguments(input),
    ...entrypointArguments(input),
    ...environmentArguments,
    ...mountArguments,
    input.image,
    ...input.command,
  ]);
  return { name: input.name, logFiles: input.logFiles };
}

async function logFileText(input: { container: Container; logFile: string }): Promise<string> {
  const { stdout } = await runCommand(DOCKER, ['exec', input.container.name, 'sh', '-c', `cat ${input.logFile} 2>/dev/null; true`], {
    maxBuffer: LOG_BUFFER_BYTES,
  });
  return stdout;
}

export async function containerLogs(input: { container: Container }): Promise<string> {
  const { stdout, stderr } = await runCommand(DOCKER, ['logs', input.container.name], { maxBuffer: LOG_BUFFER_BYTES });
  const isRunning = await isContainerRunning(input);
  const readableFiles = isRunning ? input.container.logFiles : [];
  const fileTexts = await Promise.all(readableFiles.map((logFile) => logFileText({ container: input.container, logFile })));
  return [stdout, stderr, ...fileTexts].join('\n');
}

export async function stopContainer(input: { container: Container }): Promise<void> {
  await runCommand(DOCKER, ['stop', '-t', STOP_TIMEOUT_SECONDS, input.container.name]);
}

export async function restartStoppedContainer(input: { container: Container }): Promise<void> {
  await runCommand(DOCKER, ['start', input.container.name]);
}

export async function containerExitCode(input: { container: Container }): Promise<number> {
  const { stdout } = await runCommand(DOCKER, ['inspect', '-f', '{{.State.ExitCode}}', input.container.name]);
  return Number(stdout.trim());
}

export async function isContainerRunning(input: { container: Container }): Promise<boolean> {
  const { stdout } = await runCommand(DOCKER, ['inspect', '-f', '{{.State.Running}}', input.container.name]);
  return stdout.trim() === 'true';
}

export async function removeContainer(input: { container: Container }): Promise<void> {
  await runCommand(DOCKER, ['rm', '-fv', input.container.name]);
}

export async function buildImage(input: {
  tag: string;
  contextDirectory: string;
  dockerfile: string;
  platform: string | null;
  buildArguments: Record<string, string>;
}): Promise<void> {
  const buildArguments = Object.entries(input.buildArguments).flatMap(([name, value]) => ['--build-arg', `${name}=${value}`]);
  await runCommand(
    DOCKER,
    ['build', '-t', input.tag, '-f', input.dockerfile, ...platformArguments(input), ...buildArguments, input.contextDirectory],
    { maxBuffer: LOG_BUFFER_BYTES },
  );
}
