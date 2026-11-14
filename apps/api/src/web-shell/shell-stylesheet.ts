import shellStylesheetText from './assets/shell.css';

export const SHELL_STYLESHEET: string = shellStylesheetText;

export function withShellStylesheet(input: { surfaceStylesheet: string }): string {
  return `${SHELL_STYLESHEET}\n${input.surfaceStylesheet}`;
}
