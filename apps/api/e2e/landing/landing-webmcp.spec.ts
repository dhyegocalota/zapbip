import { InstallClient } from '@zapbip/agents/install';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { waitlistRows } from './support/landing-database';

const AGENT_EMAIL = 'agent@example.com';
const TOOL_NAMES = ['fill_join_form', 'get_pricing', 'get_quick_start', 'switch_language'];
const FIRST_AGENT = Object.values(InstallClient)[0]!;
const REGISTERED_NAMES_SCRIPT = 'window.registeredTools.map((tool) => tool.name)';
const REGISTERED_COUNT_SCRIPT = 'window.registeredTools.length';
const REGISTERED_SHAPES_SCRIPT = 'window.registeredTools.map((tool) => ({ description: tool.description, type: tool.inputSchema.type }))';
const STUB_SCRIPT = `
  window.registeredTools = [];
  const modelContext = { registerTool(tool) { window.registeredTools.push(tool); return Promise.resolve(); } };
  Object.defineProperty(__HOLDER__, 'modelContext', { value: modelContext, configurable: true });
`;

type ToolResult = { content: { type: string; text: string }[]; isError?: boolean };

async function stubModelContext(input: { page: Page; holder: 'document' | 'navigator' }): Promise<void> {
  await input.page.addInitScript(STUB_SCRIPT.replace('__HOLDER__', input.holder));
}

function callScript(input: { name: string; parameters: Record<string, string> }): string {
  return `window.registeredTools.find((tool) => tool.name === ${JSON.stringify(input.name)}).execute(${JSON.stringify(input.parameters)})`;
}

async function callTool(input: {
  page: Page;
  name: string;
  parameters: Record<string, string>;
}): Promise<{ result: ToolResult; data: Record<string, unknown> }> {
  const result = (await input.page.evaluate(callScript(input))) as ToolResult;
  return { result, data: JSON.parse(result.content[0]!.text) as Record<string, unknown> };
}

test('registers the four tools on document.modelContext', async ({ page }) => {
  await stubModelContext({ page, holder: 'document' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_NAMES_SCRIPT)).toEqual(TOOL_NAMES);
});

test('falls back to navigator.modelContext of the earlier drafts', async ({ page }) => {
  await stubModelContext({ page, holder: 'navigator' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_COUNT_SCRIPT)).toBe(TOOL_NAMES.length);
});

test('every tool has a description and an object schema', async ({ page }) => {
  await stubModelContext({ page, holder: 'document' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_COUNT_SCRIPT)).toBe(TOOL_NAMES.length);
  const shapes = (await page.evaluate(REGISTERED_SHAPES_SCRIPT)) as { description: string; type: string }[];
  shapes.forEach((shape) => {
    expect(shape.description.length).toBeGreaterThan(0);
    expect(shape.type).toBe('object');
  });
});

test('fill_join_form fills the email into the form and leaves the waitlist untouched', async ({ page }) => {
  await stubModelContext({ page, holder: 'document' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_COUNT_SCRIPT)).toBe(TOOL_NAMES.length);
  const { result, data } = await callTool({ page, name: 'fill_join_form', parameters: { email: AGENT_EMAIL } });
  expect(result.isError).toBeUndefined();
  expect(data.status).toBe('filled');
  await expect(page.locator('#join-email')).toHaveValue(AGENT_EMAIL);
  await expect(page.locator('.join-form button')).toBeFocused();
  expect(waitlistRows().map((row) => row.email)).not.toContain(AGENT_EMAIL);
});

test('the page opens with the form already filled in by the email of the link', async ({ page }) => {
  await page.goto(`/?email=${AGENT_EMAIL}`);
  await expect(page.locator('#join-email')).toHaveValue(AGENT_EMAIL);
});

test('get_pricing and get_quick_start return the data of the endpoints', async ({ page }) => {
  await stubModelContext({ page, holder: 'document' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_COUNT_SCRIPT)).toBe(TOOL_NAMES.length);
  const pricing = await callTool({ page, name: 'get_pricing', parameters: {} });
  const quickStart = await callTool({ page, name: 'get_quick_start', parameters: { agent: FIRST_AGENT } });
  expect(pricing.data.currency).toBe('USD');
  expect(quickStart.data.agent).toBe(FIRST_AGENT);
  expect(String(quickStart.data.code).length).toBeGreaterThan(0);
});

test('switch_language goes to the other language page', async ({ page }) => {
  await stubModelContext({ page, holder: 'document' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(REGISTERED_COUNT_SCRIPT)).toBe(TOOL_NAMES.length);
  await page.evaluate(callScript({ name: 'switch_language', parameters: { language: 'pt-BR' } }));
  await expect(page).toHaveURL(/\/pt-br$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('a browser without WebMCP loads the page with no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.join-form')).toBeVisible();
  expect(errors).toEqual([]);
});
