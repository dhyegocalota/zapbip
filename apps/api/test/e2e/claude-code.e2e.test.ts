import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { MessageKind, SECOND_MS } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { connectAgent, historyOf, lastQuestion, mcpUrl, postOwnerText, readScreen, secretOf, tapLastQuestion } from './stack';

const runCommand = promisify(execFile);
const CLAUDE_E2E_FLAG = 'ZAPBIP_CLAUDE_E2E';
const isEnabled = process.env[CLAUDE_E2E_FLAG] === '1';
const SERVER_NAME = 'zapbip';
const AGENT = 'alpha';
const PROMPT_TIMEOUT_MS = 120 * SECOND_MS;
const TAP_DELAY_MS = 3 * SECOND_MS;
const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const ALLOWED_TOOLS = `--allowedTools=mcp__${SERVER_NAME}`;
const UPLOAD_ALLOWED_TOOLS = `--allowedTools=mcp__${SERVER_NAME},Bash`;
const ABANDON_AFTER_MS = 10 * SECOND_MS;
const ANSWER_AFTER_MS = 15 * SECOND_MS;
const PNG_FILE_NAME = 'upload.png';
const PNG_BYTES = Buffer.alloc(1024, 7);
const PNG_TYPE = 'image/png';

let configDirectory: string;

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
  });

  afterAll(async () => {
    await rm(configDirectory, { recursive: true, force: true });
  });

  test(
    'CC-1 Claude Code sends a message',
    async () => {
      const configPath = await writeConfig({ secret: secretOf({ agent: AGENT }), name: 'cc-1' });
      const output = await prompt({ text: 'send the text `teste` to the owner with send_message', configPath });
      expect(output).toContain('sent');
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
      const answered = prompt({ text: 'ask the owner with two options `Sim` and `Não` using the ask tool', configPath });
      await delay(TAP_DELAY_MS);
      const inspector = await connectAgent({ agent: AGENT });
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
      await runCommand(
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
      expect(link).toBeTruthy();
      const downloaded = await fetch(String(link));
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(PNG_BYTES);
    },
    PROMPT_TIMEOUT_MS,
  );
});
