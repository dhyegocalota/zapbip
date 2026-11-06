import { describe, expect, test } from 'vitest';
import { WHATSAPP_TEXT_MAX_CHARS } from '../inbox/constants';
import { PART_LABEL_BUDGET_CHARS } from './constants';
import { splitInstallPrompt } from './install-prompt-parts';

const SLICE_BUDGET_CHARS = WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS;
const LINK_LINE = 'https://zapbip.example/c/zb_conn_secret/mcp';

function buildLines(input: { count: number; width: number }): string[] {
  return Array.from({ length: input.count }, (_unused, index) => `${index}`.padEnd(input.width, 'x'));
}

function rejoin(input: { parts: string[] }): string {
  return input.parts.map((part) => part.slice(part.indexOf('\n') + 1)).join('');
}

describe('splitInstallPrompt', () => {
  test('labels a short prompt 1/1', () => {
    const prompt = `Install:\n${LINK_LINE}`;
    expect(splitInstallPrompt({ prompt })).toEqual([`1/1\n${prompt}`]);
  });

  test('splits a long prompt on line boundaries into labelled parts that rejoin exactly', () => {
    const prompt = buildLines({ count: 90, width: 99 }).join('\n');
    const parts = splitInstallPrompt({ prompt });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((part) => part.split('\n')[0])).toEqual(parts.map((_part, index) => `${index + 1}/${parts.length}`));
    expect(parts.every((part) => part.length <= WHATSAPP_TEXT_MAX_CHARS)).toBe(true);
    expect(rejoin({ parts })).toBe(prompt);
  });

  test('splits 9000 characters into three parts', () => {
    const prompt = buildLines({ count: 90, width: 99 }).join('\n');
    expect(prompt.length).toBeGreaterThan(8000);
    expect(splitInstallPrompt({ prompt })).toHaveLength(3);
  });

  test('keeps the link line whole in one part', () => {
    const filler = buildLines({ count: 1, width: SLICE_BUDGET_CHARS - 20 });
    const prompt = [...filler, LINK_LINE, 'after'].join('\n');
    const parts = splitInstallPrompt({ prompt });
    expect(parts.filter((part) => part.includes(LINK_LINE))).toHaveLength(1);
    expect(parts.every((part) => part.length <= WHATSAPP_TEXT_MAX_CHARS)).toBe(true);
    expect(rejoin({ parts })).toBe(prompt);
  });

  test('throws naming a link line longer than the budget', () => {
    const prompt = `https://zapbip.example/${'a'.repeat(SLICE_BUDGET_CHARS)}`;
    expect(() => splitInstallPrompt({ prompt })).toThrow(/link line/);
  });

  test('throws naming a line longer than the budget', () => {
    expect(() => splitInstallPrompt({ prompt: 'x'.repeat(SLICE_BUDGET_CHARS + 1) })).toThrow(/line/);
  });

  test('fits a line exactly at the budget in one part', () => {
    const prompt = 'x'.repeat(SLICE_BUDGET_CHARS);
    const parts = splitInstallPrompt({ prompt });
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveLength(WHATSAPP_TEXT_MAX_CHARS - PART_LABEL_BUDGET_CHARS + '1/1\n'.length);
  });

  test('throws on an empty prompt', () => {
    expect(() => splitInstallPrompt({ prompt: '' })).toThrow(/empty/);
  });
});
