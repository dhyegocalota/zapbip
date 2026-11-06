import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONNECTION_URL_VARIABLE, ConnectorClient, UUID_PATTERN } from '@zapbip/types';
import { runChannel } from './channel';
import { deriveConnectorLinks, runConnection } from './connect';
import { readHiddenLine } from './hidden-prompt';
import { runListen } from './listen';

export type ConnectArguments = {
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
};

enum CliCommand {
  Connect = 'connect',
  Listen = 'listen',
  Channel = 'channel',
}

enum CliFlag {
  Client = '--client',
  WorkingDirectory = '--cwd',
  Session = '--session',
}

type CliCommandHandler = (input: { argv: string[] }) => Promise<number>;

const CHANNEL_LINK_MESSAGE = `the channel reads the connection link from ${CONNECTION_URL_VARIABLE}`;
const CONNECTION_PROMPT = 'Connection link: ';
const USAGE = `usage: zapbip ${CliCommand.Connect} ${CliFlag.Client} ${Object.values(ConnectorClient).join('|')} [${CliFlag.WorkingDirectory} <directory>] [${CliFlag.Session} <uuid>]`;
const FAILURE_EXIT_CODE = 1;
const CLEAN_EXIT_CODE = 0;
const HELP_FLAG = '--help';
const HELP_TEXT = [
  USAGE,
  `       zapbip ${CliCommand.Listen}`,
  `       zapbip ${CliCommand.Channel}`,
  `${CONNECTION_URL_VARIABLE} holds the connection link; ${CliCommand.Connect} and ${CliCommand.Listen} ask for it when it is not set.`,
].join('\n');
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function readFlags(input: { argv: string[] }): Map<string, string> {
  const names = input.argv.filter((_, index) => index % 2 === 0);
  const values = input.argv.filter((_, index) => index % 2 === 1);
  const knownFlags: string[] = Object.values(CliFlag);
  const hasOnlyKnownFlags = names.every((name) => knownFlags.includes(name));
  if (names.length !== values.length || !hasOnlyKnownFlags) throw new Error(USAGE);
  return new Map(names.map((name, index) => [name, values[index] as string]));
}

function readClient(input: { flags: Map<string, string> }): ConnectorClient {
  const client = Object.values(ConnectorClient).find((candidate) => candidate === input.flags.get(CliFlag.Client));
  if (client === undefined) throw new Error(USAGE);
  return client;
}

function readWorkingDirectory(input: { flags: Map<string, string> }): string {
  const flagValue = input.flags.get(CliFlag.WorkingDirectory);
  if (flagValue === undefined) return process.cwd();
  const workingDirectory = resolve(flagValue);
  const isDirectory = existsSync(workingDirectory) && statSync(workingDirectory).isDirectory();
  if (!isDirectory) throw new Error(USAGE);
  return workingDirectory;
}

function readPinnedSessionId(input: { flags: Map<string, string> }): string | null {
  const flagValue = input.flags.get(CliFlag.Session);
  if (flagValue === undefined) return null;
  if (!UUID_PATTERN.test(flagValue)) throw new Error(USAGE);
  return flagValue;
}

export function parseConnectArguments(input: { argv: string[] }): ConnectArguments {
  const flags = readFlags(input);
  return {
    client: readClient({ flags }),
    workingDirectory: readWorkingDirectory({ flags }),
    pinnedSessionId: readPinnedSessionId({ flags }),
  };
}

async function readConnectionLink(): Promise<string> {
  const fromEnvironment = process.env[CONNECTION_URL_VARIABLE];
  if (fromEnvironment !== undefined && fromEnvironment !== '') return fromEnvironment;
  const answer = await readHiddenLine({ stdin: process.stdin, output: process.stderr, prompt: CONNECTION_PROMPT });
  return answer.trim();
}

function startShutdownController(): AbortController {
  const abortController = new AbortController();
  SHUTDOWN_SIGNALS.forEach((signalName) => process.once(signalName, () => abortController.abort()));
  return abortController;
}

async function connectCommand(input: { argv: string[] }): Promise<number> {
  const { client, workingDirectory, pinnedSessionId } = parseConnectArguments(input);
  const { socketLink } = deriveConnectorLinks({ connectionLink: await readConnectionLink() });
  const abortController = startShutdownController();
  return runConnection({ socketLink, client, workingDirectory, pinnedSessionId, signal: abortController.signal });
}

function assertNoArguments(input: { argv: string[] }): void {
  if (input.argv.length > 0) throw new Error(USAGE);
}

async function listenCommand(input: { argv: string[] }): Promise<number> {
  assertNoArguments(input);
  const { socketLink } = deriveConnectorLinks({ connectionLink: await readConnectionLink() });
  const abortController = startShutdownController();
  return runListen({ socketLink, write: ({ line }) => process.stdout.write(line), signal: abortController.signal });
}

async function channelCommand(input: { argv: string[] }): Promise<number> {
  assertNoArguments(input);
  const connectionLink = process.env[CONNECTION_URL_VARIABLE];
  if (connectionLink === undefined || connectionLink === '') throw new Error(CHANNEL_LINK_MESSAGE);
  const { socketLink } = deriveConnectorLinks({ connectionLink });
  const abortController = startShutdownController();
  return runChannel({ socketLink, signal: abortController.signal });
}

const COMMAND_HANDLERS: Record<CliCommand, CliCommandHandler> = {
  [CliCommand.Connect]: connectCommand,
  [CliCommand.Listen]: listenCommand,
  [CliCommand.Channel]: channelCommand,
};

async function main(): Promise<number> {
  const [commandName, ...argv] = process.argv.slice(2);
  const isHelp = commandName === HELP_FLAG || argv.includes(HELP_FLAG);
  if (isHelp) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return CLEAN_EXIT_CODE;
  }
  const command = Object.values(CliCommand).find((candidate) => candidate === commandName);
  if (command === undefined) {
    process.stderr.write(`${HELP_TEXT}\n`);
    return FAILURE_EXIT_CODE;
  }
  try {
    return await COMMAND_HANDLERS[command]({ argv });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return FAILURE_EXIT_CODE;
  }
}

const entryPath = process.argv[1];
const isEntryPoint = entryPath !== undefined && fileURLToPath(import.meta.url) === realpathSync(entryPath);
if (isEntryPoint) process.exitCode = await main();
