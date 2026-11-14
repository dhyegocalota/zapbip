import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/emails/escape-html';

describe('escapeHtml', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapes %s as %s', (character, entity) => {
    expect(escapeHtml({ text: character })).toBe(entity);
  });

  it('escapes the ampersand once, never the entity it wrote', () => {
    expect(escapeHtml({ text: '<a href="x">Tom & Jerry</a>' })).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;');
  });

  it('leaves text without special characters as it is', () => {
    expect(escapeHtml({ text: 'maria@example.com · 13/11, 09:05' })).toBe('maria@example.com · 13/11, 09:05');
  });
});
