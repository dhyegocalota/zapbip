import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { MessageDirection, MessageKind, SECOND_MS } from '@zapbip/types';
import { chromium } from '@playwright/test';
import { z } from 'zod';
import { FAVICON_SVG } from '../src/backoffice/assets/favicon';
import type { ScreenEntry } from '../src/contract/account-inbox-rpc';
import { DEV_SEED_PATH } from '../src/contract/constants';
import { McpToolName } from '../src/contract/tool-definitions';
import { freePort, HEALTH_TIMEOUT_MS, LOOPBACK_HOST, waitForHealth } from '../test/e2e/support/stack-process';

const runCommand = promisify(execFile);
const SCRIPT_DIRECTORY = import.meta.dirname;
const OUTPUT_DIRECTORY = join(SCRIPT_DIRECTORY, '..', 'site-public', 'site');
const STAGE_FILE = join(SCRIPT_DIRECTORY, 'landing-demo', 'stage.html');
const OPEN_GRAPH_FILE = join(SCRIPT_DIRECTORY, 'landing-demo', 'og.html');
const DATABASE_BINDING = 'CONNECTIONS';
const DEVELOPMENT_ENVIRONMENT = 'development';
const OWNER_PHONE = '5511999990000';
const AGENT_NAME = 'claude-code';
const OWNER_OPENING_TEXT = 'run the tests';
const QUESTION = 'Tests pass. Deploy v2.4 to production?';
const TERMINAL_QUESTION = 'Deploy v2.4 to production?';
const OPTIONS = ['Ship it', 'Wait'];
const DONE_TEXT = 'Done. v2.4 is live.';
const LIVE_TEXT = 'v2.4 is live';
const TESTS_PASSED = '128 tests passed';
const CHOSEN_INDEX = 0;
const POLL_INTERVAL_MS = 200;
const POLL_DEADLINE_MS = 30 * SECOND_MS;
const SIGNING_KEY_BYTES = 32;
const LOOP_SECONDS = 12;
const FRAMES_PER_SECOND = 30;
const STAGE_SIZE = 1080;
const ENCODED_SIZE = 960;
const POSTER_SECOND = 4.8;
const SMALL_POSTER_SIZE = 540;
const OPEN_GRAPH_SIZE = { width: 1200, height: 630 };
const TOUCH_ICON_SIZE = 180;
const OPEN_GRAPH_LIMIT_BYTES = 300_000;
const OPEN_GRAPH_COLORS = '192';
const DEMO_FILES = {
  mp4: 'demo-960.mp4',
  webm: 'demo-960.webm',
  posterLarge: 'demo-poster-960.webp',
  posterSmall: 'demo-poster-540.webp',
  openGraph: 'og.png',
  touchIcon: 'apple-touch-icon.png',
};

const seedOutputSchema = z.object({ connections: z.array(z.object({ agent: z.string(), secret: z.string() })) });
const screenSchema = z.object({
  entries: z.array(z.object({ at: z.number(), text: z.string(), options: z.array(z.string()) })),
});

type DemoData = {
  agentName: string;
  question: string;
  questionShort: string;
  options: string[];
  answer: string;
  doneText: string;
  liveText: string;
  testsPassed: string;
};

type ScreenResponse = { entries: Pick<ScreenEntry, 'at' | 'text' | 'options'>[] };

function titleCaseOf(input: { name: string }): string {
  return input.name
    .split('-')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

async function readScreen(input: { origin: string }): Promise<ScreenResponse['entries']> {
  const response = await fetch(`${input.origin}/dev/owner/${OWNER_PHONE}/screen`);
  return screenSchema.parse(await response.json()).entries;
}

async function untilScreen(input: { origin: string; isReady: (entries: ScreenResponse['entries']) => boolean; deadline: number }) {
  const entries = await readScreen({ origin: input.origin });
  if (input.isReady(entries)) return entries;
  if (Date.now() > input.deadline) throw new Error('the fake WhatsApp screen never showed the expected entry');
  await delay(POLL_INTERVAL_MS);
  return untilScreen(input);
}

async function startWorker(input: { persistDirectory: string }): Promise<{ origin: string; stop: () => void }> {
  const port = await freePort();
  const origin = `http://${LOOPBACK_HOST}:${port}`;
  const persistArguments = ['--persist-to', input.persistDirectory];
  await runCommand('pnpm', [
    'exec',
    'wrangler',
    'd1',
    'migrations',
    'apply',
    DATABASE_BINDING,
    '--env',
    DEVELOPMENT_ENVIRONMENT,
    '--local',
    ...persistArguments,
  ]);
  const variables = {
    MEDIA_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    UPLOAD_LINK_SIGNING_KEY: randomBytes(SIGNING_KEY_BYTES).toString('hex'),
    PUBLIC_ORIGIN: origin,
    WAKE_SECRET_KEY: randomBytes(WAKE_SECRET_KEY_BYTES).toString('base64'),
    NUMBER_REGISTRY_KEY: randomBytes(WAKE_SECRET_KEY_BYTES).toString('base64'),
  };
  const server = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--env',
      DEVELOPMENT_ENVIRONMENT,
      '--ip',
      LOOPBACK_HOST,
      '--port',
      String(port),
      ...persistArguments,
      ...Object.entries(variables).flatMap(([name, value]) => ['--var', `${name}:${value}`]),
    ],
    { stdio: 'ignore', detached: true },
  );
  await waitForHealth({ origin, server, deadline: Date.now() + HEALTH_TIMEOUT_MS });
  return { origin, stop: () => (server.pid === undefined ? undefined : process.kill(-server.pid, 'SIGTERM')) };
}

async function seedAgent(input: { origin: string }): Promise<string> {
  const response = await fetch(`${input.origin}${DEV_SEED_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: OWNER_PHONE, agents: [AGENT_NAME] }),
  });
  const [connection] = seedOutputSchema.parse(await response.json()).connections;
  if (connection === undefined) throw new Error('the development seed returned no connection');
  return connection.secret;
}

async function optionIdOf(input: { client: Client; index: number }): Promise<{ optionId: string; title: string }> {
  const result = await input.client.callTool({ name: McpToolName.GetMessages, arguments: {} });
  const history = (
    result.structuredContent as {
      history: { kind: MessageKind; direction: MessageDirection; choice: { options: { option_id: string; title: string }[] } | null }[];
    }
  ).history;
  const question = history
    .filter((message) => message.kind === MessageKind.Choice && message.direction === MessageDirection.ToOwner)
    .at(-1);
  const option = question?.choice?.options[input.index];
  if (option === undefined) throw new Error('the question has no option to tap');
  return { optionId: option.option_id, title: option.title };
}

async function recordFlow(input: { origin: string; secret: string }): Promise<DemoData> {
  const { origin } = input;
  const client = new Client({ name: 'zapbip-landing-demo', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/c/${input.secret}/mcp`)));
  await fetch(`${origin}/dev/owner/${OWNER_PHONE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: MessageKind.Text, text: OWNER_OPENING_TEXT }),
  });
  const heldAnswer = client.callTool({
    name: McpToolName.Ask,
    arguments: { question: QUESTION, options: OPTIONS.map((title) => ({ title })) },
  });
  const asked = await untilScreen({
    origin,
    isReady: (entries) => entries.some((entry) => entry.options.length > 0),
    deadline: Date.now() + POLL_DEADLINE_MS,
  });
  const question = asked.find((entry) => entry.options.length > 0)!;
  const { optionId, title } = await optionIdOf({ client, index: CHOSEN_INDEX });
  await fetch(`${origin}/dev/owner/${OWNER_PHONE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: MessageKind.Choice, option_id: optionId, title }),
  });
  const answered = (await heldAnswer).structuredContent as { answer: string };
  await client.callTool({ name: McpToolName.SendMessage, arguments: { text: DONE_TEXT } });
  const finished = await untilScreen({
    origin,
    isReady: (entries) => entries.some((entry) => entry.text.includes(DONE_TEXT)),
    deadline: Date.now() + POLL_DEADLINE_MS,
  });
  await client.close();
  return {
    agentName: titleCaseOf({ name: AGENT_NAME }),
    question: TERMINAL_QUESTION,
    questionShort: question.text,
    options: question.options,
    answer: answered.answer,
    doneText: finished.find((entry) => entry.text.includes(DONE_TEXT))!.text,
    liveText: LIVE_TEXT,
    testsPassed: TESTS_PASSED,
  };
}

function frameName(input: { index: number }): string {
  return `frame-${String(input.index).padStart(4, '0')}.png`;
}

async function renderFrames(input: { data: DemoData; framesDirectory: string }): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: STAGE_SIZE, height: STAGE_SIZE }, deviceScaleFactor: 1 });
  await page.addInitScript(`window.DEMO = ${JSON.stringify(input.data)};`);
  await page.goto(`file://${STAGE_FILE}`);
  const frameCount = LOOP_SECONDS * FRAMES_PER_SECOND;
  await Array.from({ length: frameCount }, (_, index) => index).reduce(async (previous, index) => {
    await previous;
    await page.evaluate(`window.renderAt(${index / FRAMES_PER_SECOND})`);
    await page.screenshot({ path: join(input.framesDirectory, frameName({ index })) });
  }, Promise.resolve());
  await browser.close();
}

async function renderStill(input: {
  data: DemoData;
  file: string;
  target: string;
  size: { width: number; height: number };
}): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: input.size, deviceScaleFactor: 1 });
  await page.addInitScript(`window.DEMO = ${JSON.stringify(input.data)};`);
  await page.goto(`file://${input.file}`);
  await page.screenshot({ path: input.target });
  await browser.close();
}

async function renderTouchIcon(input: { target: string }): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: TOUCH_ICON_SIZE, height: TOUCH_ICON_SIZE }, deviceScaleFactor: 1 });
  await page.setContent(
    `<body style="margin:0">${FAVICON_SVG.replace('<svg ', `<svg width="${TOUCH_ICON_SIZE}" height="${TOUCH_ICON_SIZE}" `)}</body>`,
  );
  await page.screenshot({ path: input.target });
  await browser.close();
}

async function encode(input: { framesDirectory: string }): Promise<void> {
  const mp4 = join(OUTPUT_DIRECTORY, DEMO_FILES.mp4);
  const scale = `scale=${ENCODED_SIZE}:${ENCODED_SIZE}:flags=lanczos,format=yuv420p`;
  await runCommand('ffmpeg', [
    '-y',
    '-framerate',
    String(FRAMES_PER_SECOND),
    '-i',
    join(input.framesDirectory, 'frame-%04d.png'),
    '-vf',
    scale,
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-preset',
    'slow',
    '-crf',
    '26',
    '-movflags',
    '+faststart',
    '-an',
    mp4,
  ]);
  await runCommand('ffmpeg', [
    '-y',
    '-i',
    mp4,
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '0',
    '-crf',
    '36',
    '-row-mt',
    '1',
    '-deadline',
    'good',
    '-an',
    join(OUTPUT_DIRECTORY, DEMO_FILES.webm),
  ]);
  await runCommand('ffmpeg', [
    '-y',
    '-ss',
    String(POSTER_SECOND),
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    '82',
    join(OUTPUT_DIRECTORY, DEMO_FILES.posterLarge),
  ]);
  await runCommand('ffmpeg', [
    '-y',
    '-ss',
    String(POSTER_SECOND),
    '-i',
    mp4,
    '-frames:v',
    '1',
    '-vf',
    `scale=${SMALL_POSTER_SIZE}:${SMALL_POSTER_SIZE}:flags=lanczos`,
    '-c:v',
    'libwebp',
    '-quality',
    '80',
    join(OUTPUT_DIRECTORY, DEMO_FILES.posterSmall),
  ]);
}

async function shrinkOpenGraphIfNeeded(input: { target: string }): Promise<void> {
  if ((await stat(input.target)).size <= OPEN_GRAPH_LIMIT_BYTES) return;
  await runCommand('magick', [input.target, '-strip', '-colors', OPEN_GRAPH_COLORS, `PNG8:${input.target}`]);
}

async function main(): Promise<void> {
  const workDirectory = await mkdtemp(join(tmpdir(), 'zapbip-landing-demo-'));
  const framesDirectory = join(workDirectory, 'frames');
  await mkdir(framesDirectory);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const worker = await startWorker({ persistDirectory: workDirectory });
  const data = await recordFlow({ origin: worker.origin, secret: await seedAgent({ origin: worker.origin }) }).finally(() => worker.stop());
  await writeFile(join(workDirectory, 'demo-data.json'), JSON.stringify(data));
  await renderFrames({ data, framesDirectory });
  await encode({ framesDirectory });
  const openGraph = join(OUTPUT_DIRECTORY, DEMO_FILES.openGraph);
  await renderStill({ data, file: OPEN_GRAPH_FILE, target: openGraph, size: OPEN_GRAPH_SIZE });
  await shrinkOpenGraphIfNeeded({ target: openGraph });
  await renderTouchIcon({ target: join(OUTPUT_DIRECTORY, DEMO_FILES.touchIcon) });
  await rm(workDirectory, { recursive: true, force: true });
  console.log(JSON.stringify(data));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
