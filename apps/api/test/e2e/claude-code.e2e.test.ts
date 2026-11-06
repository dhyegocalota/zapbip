import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { MessageKind, SECOND_MS } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { mcpUrl, postOwner, postOwnerText, readScreen, secretOf } from './stack';

const runCommand = promisify(execFile);
const CLAUDE_E2E_FLAG = 'ZAPBIP_CLAUDE_E2E';
const isEnabled = process.env[CLAUDE_E2E_FLAG] === '1';
const SERVER_NAME = 'zapbip';
const AGENT = 'alpha';
const PROMPT_TIMEOUT_MS = 120 * SECOND_MS;
const TAP_DELAY_MS = 3 * SECOND_MS;
const UNKNOWN_SECRET = `zb_conn_${'A'.repeat(43)}`;
const ALLOWED_TOOLS = `--allowedTools=mcp__${SERVER_NAME}`;

let configDirectory: string;

async function writeConfig(input: { secret: string; name: string }): Promise<string> {
  const path = join(configDirectory, `${input.name}.json`);
  await writeFile(path, JSON.stringify({ mcpServers: { [SERVER_NAME]: { type: 'http', url: mcpUrl({ secret: input.secret }) } } }));
  return path;
}

async function prompt(input: { text: string; configPath: string }): Promise<string> {
  const { stdout } = await runCommand(
    'claude',
    ['-p', input.text, '--mcp-config', input.configPath, '--strict-mcp-config', ALLOWED_TOOLS],
    { timeout: PROMPT_TIMEOUT_MS },
  );
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
      const prompts = (await readScreen()).filter((entry) => entry.options.length > 0);
      const optionId = prompts.at(-1)?.options[1];
      await postOwner({ body: { kind: MessageKind.Choice, option_id: optionId, title: 'Não' } });
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
});
