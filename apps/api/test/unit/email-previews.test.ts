import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@react-email/render';
import { OwnerLocale } from '@zapbip/types';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { SUBSCRIBER_DIGEST_EMAIL, WELCOME_EMAILS } from '../../src/emails/generated/email-templates';

const PREVIEWS_DIRECTORY = new URL('../../scripts/emails/previews/', import.meta.url).pathname;
const WELCOME_PREVIEW_PREFIX = 'welcome-';
const DIGEST_PREVIEW_FILE = 'subscriber-digest.ts';

type PreviewModule = { default: () => ReactElement };

async function renderedPreviewsOf(input: { startsWith: string }): Promise<string[]> {
  const files = readdirSync(PREVIEWS_DIRECTORY).filter((file) => file.startsWith(input.startsWith));
  return Promise.all(
    files.map(async (file) => {
      const preview = (await import(join(PREVIEWS_DIRECTORY, file))) as PreviewModule;
      return render(preview.default());
    }),
  );
}

describe('the React Email studio previews', () => {
  it('show the welcome in every language exactly as it is generated', async () => {
    const rendered = await renderedPreviewsOf({ startsWith: WELCOME_PREVIEW_PREFIX });
    const generated = Object.values(OwnerLocale).map((locale) => WELCOME_EMAILS[locale].html);
    expect(rendered).toHaveLength(Object.values(OwnerLocale).length);
    expect([...rendered].sort()).toEqual([...generated].sort());
  });

  it('show the digest as it is generated', async () => {
    const [rendered] = await renderedPreviewsOf({ startsWith: DIGEST_PREVIEW_FILE });
    expect(rendered).toBe(SUBSCRIBER_DIGEST_EMAIL.shell.html);
  });
});
