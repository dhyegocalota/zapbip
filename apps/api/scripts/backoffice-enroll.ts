import { renderUnicodeCompact } from 'uqr';

export function renderTerminalQr(input: { text: string }): string {
  return renderUnicodeCompact(input.text);
}
