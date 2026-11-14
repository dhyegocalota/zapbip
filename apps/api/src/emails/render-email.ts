import { render, toPlainText } from '@react-email/render';
import type { ReactElement } from 'react';

export type RenderedEmail = { html: string; text: string };

const PLAIN_TEXT_OPTIONS: Parameters<typeof toPlainText>[1] = {
  selectors: [
    { selector: 'h1', options: { uppercase: false } },
    { selector: 'h2', options: { uppercase: false } },
  ],
};

export async function renderEmail(input: { element: ReactElement }): Promise<RenderedEmail> {
  const html = await render(input.element);
  return { html, text: toPlainText(html, PLAIN_TEXT_OPTIONS) };
}
