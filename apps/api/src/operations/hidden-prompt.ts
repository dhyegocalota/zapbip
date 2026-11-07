import type { OutputStream } from './terminal-shell';

export async function readHiddenLine(input: {
  question: string;
  terminalInput: NodeJS.ReadableStream;
  outputStream: OutputStream;
}): Promise<string> {
  throw new Error(`readHiddenLine is not implemented ${input.question}`);
}
