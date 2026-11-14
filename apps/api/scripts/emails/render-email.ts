import { render, toPlainText } from '@react-email/render';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GeneratedEmailPart } from '../../src/emails/generated-email';

const PLAIN_TEXT_OPTIONS: Parameters<typeof toPlainText>[1] = {
  selectors: [
    { selector: 'h1', options: { uppercase: false } },
    { selector: 'h2', options: { uppercase: false } },
  ],
};

export async function renderEmail(input: { element: ReactElement }): Promise<GeneratedEmailPart> {
  const html = await render(input.element);
  return { html, text: toPlainText(html, PLAIN_TEXT_OPTIONS) };
}

export function renderFragment(input: { element: ReactElement }): GeneratedEmailPart {
  const html = renderToStaticMarkup(input.element);
  return { html, text: toPlainText(html, PLAIN_TEXT_OPTIONS) };
}
