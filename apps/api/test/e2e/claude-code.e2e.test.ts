import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { MessageKind, SECOND_MS } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import { type IsolatedStack, startIsolatedStack } from './claude-code-stack';
import type { StackContext } from './global-setup';
import { callTool, connectAgent, historyOf, lastQuestion, mcpUrl, postOwnerText, readScreen, secretOf, tapLastQuestion } from './stack';

const isolated = vi.hoisted(() => ({ context: null as StackContext | null }));

vi.mock('vitest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vitest')>()),
  inject: () => isolated.context,
}));

const runCommand = promisify(execFile);
const CLAUDE_E2E_FLAG = 'ZAPBIP_CLAUDE_E2E';
const isEnabled = process.env[CLAUDE_E2E_FLAG] === '1';
const SERVER_NAME = 'zapbip';
const AGENT = 'alpha';
const PROMPT_TIMEOUT_MS = 120 * SECOND_MS;
const QUESTION_TIMEOUT_MS = 90 * SECOND_MS;
const QUESTION_POLL_INTERVAL_MS = 500;
const DELIVERY_SENT_PATTERN = /"delivery":"sent"/;
const STREAM_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const STREAM_ARGUMENTS = ['--output-format', 'stream-json', '--verbose'];
const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const ALLOWED_TOOLS = `--allowedTools=mcp__${SERVER_NAME}`;
const UPLOAD_ALLOWED_TOOLS = `--allowedTools=mcp__${SERVER_NAME},Bash`;
const ABANDON_AFTER_MS = 10 * SECOND_MS;
const ANSWER_AFTER_MS = 15 * SECOND_MS;
const PNG_FILE_NAME = 'upload.png';
const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const PNG_TYPE = 'image/png';

let configDirectory: string;
let isolatedStack: IsolatedStack;

type StreamLine = { type: string; message?: { content?: { type: string; content?: string | { type: string; text?: string }[] }[] } };

function toolResultTexts(input: { output: string }): string[] {
  return input.output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StreamLine)
    .filter((line) => line.type === 'user')
    .flatMap((line) => line.message?.content ?? [])
    .filter((block) => block.type === 'tool_result')
    .map((block) => (typeof block.content === 'string' ? block.content : (block.content ?? []).map((part) => part.text).join('')));
}

async function openWindow(): Promise<void> {
  const inspector = await connectAgent({ agent: AGENT });
  await callTool({ client: inspector, name: McpToolName.SendMessage, arguments: { text: 'ready' } });
  await postOwnerText({ text: 'open', replyTo: null });
  await inspector.close();
}

async function awaitQuestion(input: { client: Awaited<ReturnType<typeof connectAgent>> }) {
  return vi.waitFor(
    async () => {
      const question = await lastQuestion(input);
      if (!question) throw new Error('the question is not on the screen yet');
      return question;
    },
    { timeout: QUESTION_TIMEOUT_MS, interval: QUESTION_POLL_INTERVAL_MS },
  );
}

async function writeConfig(input: { secret: string; name: string }): Promise<string> {
  const path = join(configDirectory, `${input.name}.json`);
  await writeFile(path, JSON.stringify({ mcpServers: { [SERVER_NAME]: { type: 'http', url: mcpUrl({ secret: input.secret }) } } }));
  return path;
}

function claudeArguments(input: { text: string; configPath: string; allowedTools: string }): string[] {
  return ['-p', input.text, '--mcp-config', input.configPath, '--strict-mcp-config', input.allowedTools];
}

async function prompt(input: { text: string; configPath: string }): Promise<string> {
  const { stdout } = await runCommand('claude', claudeArguments({ ...input, allowedTools: ALLOWED_TOOLS }), { timeout: PROMPT_TIMEOUT_MS });
  return stdout;
}

describe.skipIf(!isEnabled)('Claude Code session against wrangler dev', () => {
  beforeAll(async () => {
    configDirectory = await mkdtemp(join(tmpdir(), 'zapbip-claude-'));
    isolatedStack = await startIsolatedStack();
    isolated.context = isolatedStack.context;
    await openWindow();
  });

  afterAll(async () => {
    await isolatedStack.stop();
    await rm(configDirectory, { recursive: true, force: true });
  });

  test(
    'CC-1 Claude Code sends a message',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-1' });
      const { stdout } = await runCommand(
        'claude',
        [
          ...claudeArguments({ text: 'send the text `teste` to the owner with send_message', configPath, allowedTools: ALLOWED_TOOLS }),
          ...STREAM_ARGUMENTS,
        ],
        { timeout: PROMPT_TIMEOUT_MS, maxBuffer: STREAM_MAX_BUFFER_BYTES },
      );
      expect(toolResultTexts({ output: stdout }).some((text) => DELIVERY_SENT_PATTERN.test(text))).toBe(true);
      expect((await readScreen()).some((entry) => entry.text.includes('teste'))).toBe(true);
    },
    PROMPT_TIMEOUT_MS,
  );

  test(
    'CC-2 Claude Code reads an owner message',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-2' });
      await postOwnerText({ text: 'qual é o plano?', replyTo: null });
      const output = await prompt({ text: "call check_inbox and quote the owner's message", configPath });
      expect(output).toContain('qual é o plano?');
    },
    PROMPT_TIMEOUT_MS,
  );

  test(
    'CC-3 Claude Code asks and gets the tap',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-3' });
      const answered = prompt({ text: 'ask the owner "Vamos?" with two options `Sim` and `Não` using the ask tool', configPath });
      const inspector = await connectAgent({ agent: AGENT });
      await awaitQuestion({ client: inspector });
      await tapLastQuestion({ client: inspector, optionIndex: 1 });
      await inspector.close();
      expect(await answered).toContain('Não');
    },
    PROMPT_TIMEOUT_MS,
  );

  test(
    'CC-6 an unknown secret is refused',
    async () => {
      const configPath = await writeConfig({ secret: UNKNOWN_SECRET, name: 'cc-6' });
      await prompt({ text: 'send the text `x` to the owner with send_message', configPath });
      expect((await readScreen()).some((entry) => entry.text === 'x')).toBe(false);
    },
    PROMPT_TIMEOUT_MS,
  );

  test(
    'CC-4 an abandoned call still recovers',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-4' });
      const abandoned = runCommand(
        'claude',
        claudeArguments({
          text: 'ask the owner "Vamos?" with options `Sim` and `Não` using the ask tool, then wait for the answer',
          configPath,
          allowedTools: ALLOWED_TOOLS,
        }),
        { timeout: ABANDON_AFTER_MS },
      ).catch(() => null);
      await abandoned;
      const inspector = await connectAgent({ agent: AGENT });
      await delay(ANSWER_AFTER_MS - ABANDON_AFTER_MS);
      await tapLastQuestion({ client: inspector, optionIndex: 1 });
      const question = await lastQuestion({ client: inspector });
      await inspector.close();
      if (!question) throw new Error('the abandoned ask left no question');
      const output = await prompt({
        text: `call wait_for_reply with question_id ${question.question_id} and report the answer`,
        configPath,
      });
      expect(output).toContain('Não');
    },
    PROMPT_TIMEOUT_MS,
  );

  test(
    'CC-5 upload from Claude Code',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-5' });
      const pngPath = join(configDirectory, PNG_FILE_NAME);
      await writeFile(pngPath, PNG_BYTES);
      const { stdout: output } = await runCommand(
        'claude',
        claudeArguments({
          text: `upload the file ${pngPath} (${PNG_TYPE}, ${PNG_BYTES.byteLength} bytes) with create_upload, PUT it to the upload_url with curl sending Content-Type and Content-Length, then send it with send_media as an image`,
          configPath,
          allowedTools: UPLOAD_ALLOWED_TOOLS,
        }),
        { timeout: PROMPT_TIMEOUT_MS },
      );
      const inspector = await connectAgent({ agent: AGENT });
      const link = (await historyOf({ client: inspector })).findLast((message) => message.kind === MessageKind.Image)?.url;
      await inspector.close();
      expect(link, output).toBeTruthy();
      const downloaded = await fetch(String(link));
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(PNG_BYTES);
    },
    PROMPT_TIMEOUT_MS,
  );
});
