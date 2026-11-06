import { OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { CONNECTION_LINK, LOCALES, sectionInput } from '../testing/fixtures';
import { ZAPBIP_NPM_VERSION } from './connector-commands';
import { renderCursorSection } from './cursor';
import { renderGeminiCliSection } from './gemini-cli';

describe('Cursor and Gemini CLI sections', () => {
  test.each(LOCALES)('Cursor in %s adds the HTTP server and listens in a background terminal', (locale) => {
    const text = renderCursorSection(sectionInput({ locale }));
    expect(text).toContain('If you are not Cursor');
    expect(text).toContain('over HTTP');
    expect(text).toContain(`npx zapbip@${ZAPBIP_NPM_VERSION} listen`);
    expect(text).toContain('background terminal');
    expect(text).not.toContain('set_wake');
    expect(text).not.toContain('scheduled');
  });

  test.each(LOCALES)('Gemini CLI in %s adds the HTTP server and listens in a background terminal', (locale) => {
    const text = renderGeminiCliSection(sectionInput({ locale }));
    expect(text).toContain('If you are not Gemini CLI');
    expect(text).toContain(`gemini mcp add --transport http --scope user zapbip ${CONNECTION_LINK}`);
    expect(text).toContain(`npx zapbip@${ZAPBIP_NPM_VERSION} listen`);
    expect(text).toContain('background terminal');
    expect(text).not.toContain('set_wake');
    expect(text).toContain('gemini --yolo -p "');
    expect(text).not.toContain('scheduled');
  });

  test.each(LOCALES)('F11 Cursor in %s asks the owner before it adds the server', (locale) => {
    const text = renderCursorSection(sectionInput({ locale }));
    expect(text.indexOf('Wait for the owner to answer')).toBeGreaterThan(-1);
    expect(text.indexOf('Wait for the owner to answer')).toBeLessThan(text.indexOf('Add an MCP server'));
  });

  test('the Cursor section never uses Grok Bot wording', () => {
    const text = renderCursorSection(sectionInput({ locale: OwnerLocale.EnglishUs }));
    expect(text).not.toContain('routine');
    expect(text).not.toContain('webhook');
  });
});
