import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { OperatorToolName } from '../../src/backoffice/operator-mcp/operator-tool-name';
import { expect, test } from './fixtures';
import { copy } from './support/copy';
import { expectNoHorizontalScroll } from './support/layout';
import { freshCode, wrongCode } from './support/operator-database';
import { signIn } from './support/sign-in';

const SHOT_DIRECTORY_VARIABLE = 'AGENT_KEYS_SHOT_DIRECTORY';
const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;
const DESKTOP_PROJECT = 'desktop';
const CODE_FIELD = '#agent-key-code';
const KEY_PATTERN = /zbo_[0-9a-f]{16}_[A-Za-z0-9_-]{43}/;
const MCP_PATH = '/mcp';
const UNAUTHORIZED_STATUS = 401;
const OK_STATUS = 200;
const TOOLS_LIST_BODY = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const MCP_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

test.beforeEach(async ({ page }, testInfo) => {
  const isDesktop = testInfo.project.name === DESKTOP_PROJECT;
  await page.setViewportSize(isDesktop ? { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT } : { width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
  await signIn({ page });
});

async function shoot(input: { page: Page; testInfo: TestInfo; name: string }): Promise<void> {
  const directory = process.env[SHOT_DIRECTORY_VARIABLE];
  if (directory === undefined) return;
  await mkdir(directory, { recursive: true });
  await input.page.screenshot({ path: join(directory, `${input.testInfo.project.name}-${input.name}.png`), fullPage: true });
}

async function openAgentKeys(input: { page: Page }): Promise<void> {
  await input.page
    .getByRole('link', { name: copy({ key: BackofficeCopyKey.NavigationAgentKeys }), exact: true })
    .first()
    .click();
  await expect(input.page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.AgentKeysTitle }) })).toBeVisible();
}

async function createKey(input: { page: Page; label: string }): Promise<string> {
  const { page, label } = input;
  await page.getByLabel(copy({ key: BackofficeCopyKey.AgentKeysLabelLabel })).fill(label);
  await page.locator(CODE_FIELD).fill(await freshCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AgentKeysCreateSubmit }) }).click();
  await expect(page.getByRole('heading', { level: 1, name: copy({ key: BackofficeCopyKey.AgentKeysCreatedTitle }) })).toBeVisible();
  const key = KEY_PATTERN.exec(await page.locator('textarea').inputValue())?.[0];
  if (key === undefined) throw new Error('the page shows no key');
  return key;
}

function listTools(input: { page: Page; key: string }) {
  return input.page.request.post(MCP_PATH, { headers: { ...MCP_HEADERS, authorization: `Bearer ${input.key}` }, data: TOOLS_LIST_BODY });
}

test('creates a key, shows it once, lets the agent in and locks it out after a revoke', async ({ page }, testInfo) => {
  await openAgentKeys({ page });
  await expect(page.getByText(copy({ key: BackofficeCopyKey.AgentKeysEmpty }))).toBeVisible();
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'agent-keys-empty' });
  const key = await createKey({ page, label: 'walk agent' });
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'agent-keys-created' });
  const accepted = await listTools({ page, key });
  expect(accepted.status()).toBe(OK_STATUS);
  const { result } = (await accepted.json()) as { result: { tools: { name: string }[] } };
  expect(result.tools.map((tool) => tool.name).sort()).toEqual(Object.values(OperatorToolName).sort());
  await page.getByRole('link', { name: copy({ key: BackofficeCopyKey.AgentKeysBack }) }).click();
  await expect(page.getByText('walk agent')).toBeVisible();
  await expect(page.getByText(key)).toHaveCount(0);
  await expectNoHorizontalScroll({ page });
  await shoot({ page, testInfo, name: 'agent-keys-list' });
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AgentKeysRevokeFor, values: { label: 'walk agent' } }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.AgentKeyRevokedNotice }))).toBeVisible();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.AgentKeysStatusRevoked }), { exact: true })).toBeVisible();
  await shoot({ page, testInfo, name: 'agent-keys-revoked' });
  expect((await listTools({ page, key })).status()).toBe(UNAUTHORIZED_STATUS);
});

test('keeps the list empty after a wrong code', async ({ page }, testInfo) => {
  await openAgentKeys({ page });
  await page.getByLabel(copy({ key: BackofficeCopyKey.AgentKeysLabelLabel })).fill('walk agent');
  await page.locator(CODE_FIELD).fill(await wrongCode());
  await page.getByRole('button', { name: copy({ key: BackofficeCopyKey.AgentKeysCreateSubmit }) }).click();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.StepUpRejected }))).toBeVisible();
  await expect(page.getByText(copy({ key: BackofficeCopyKey.AgentKeysEmpty }))).toBeVisible();
  await shoot({ page, testInfo, name: 'agent-keys-wrong-code' });
});
