import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { START_LINK_COPY } from '../../src/routes/start-link-copy';
import { renderStartUnavailablePage } from '../../src/routes/start-link-page';
import { START_LINK_STYLE, START_LINK_STYLE_HASH } from '../../src/routes/start-link-style';

const LOCALES = Object.values(OwnerLocale);
const OWNER_WORD_PATTERN = /owner|dono/i;
const FORBIDDEN_MARKUP = ['<script', '<link', 'style=', 'wa.me', 'href=', 'src=', 'http'];

const STYLE_BLOCK_PATTERN = /<style>([\s\S]*?)<\/style>/g;
const ANCHOR_PATTERN = /<a[\s>]/i;

describe('renderStartUnavailablePage', () => {
  it.each(LOCALES)('carries exactly one style block, the constant, whose hash is the exported one for %s', (locale) => {
    const blocks = [...renderStartUnavailablePage({ locale }).matchAll(STYLE_BLOCK_PATTERN)].map((match) => match[1]);
    expect(blocks).toEqual([START_LINK_STYLE]);
    expect(START_LINK_STYLE).not.toBe('');
    expect(START_LINK_STYLE_HASH).toBe(
      `sha256-${createHash('sha256')
        .update(blocks[0] as string)
        .digest('base64')}`,
    );
  });

  it.each(LOCALES)('styles light and dark and keeps no anchor, script or external resource for %s', (locale) => {
    expect(START_LINK_STYLE).toContain('prefers-color-scheme: dark');
    expect(START_LINK_STYLE).not.toMatch(/url\(|@import/);
    expect(renderStartUnavailablePage({ locale })).not.toMatch(ANCHOR_PATTERN);
  });

  it.each(LOCALES)('carries the copy of both locales when %s is asked for', (locale) => {
    const page = renderStartUnavailablePage({ locale });
    LOCALES.forEach((candidate) => {
      expect(page).toContain(START_LINK_COPY[candidate].unavailableTitle);
      expect(page).toContain(START_LINK_COPY[candidate].unavailableBody);
    });
  });

  it.each(LOCALES)('puts the copy of %s first and declares its language', (locale) => {
    const page = renderStartUnavailablePage({ locale });
    const other = LOCALES.find((candidate) => candidate !== locale) as OwnerLocale;
    expect(page.indexOf(START_LINK_COPY[locale].unavailableBody)).toBeLessThan(page.indexOf(START_LINK_COPY[other].unavailableBody));
    expect(page).toContain(`<html lang="${START_LINK_COPY[locale].htmlLanguage}">`);
  });

  it.each(LOCALES)('words the %s unavailable copy without the word owner', (locale) => {
    expect(START_LINK_COPY[locale].unavailableBody).not.toMatch(OWNER_WORD_PATTERN);
  });

  it.each(FORBIDDEN_MARKUP)('never contains %s', (markup) => {
    LOCALES.forEach((locale) => {
      expect(renderStartUnavailablePage({ locale }).toLowerCase()).not.toContain(markup);
    });
  });
});
