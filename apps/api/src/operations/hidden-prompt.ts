import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import type { OutputStream } from './terminal-shell';

const SILENT_OUTPUT = new Writable({ write: (_chunk, _encoding, done) => done() });

export async function readHiddenLine(input: {
  question: string;
  terminalInput: NodeJS.ReadableStream;
  outputStream: OutputStream;
}): Promise<string> {
  const { question, terminalInput, outputStream } = input;
  outputStream.write(question);
  const lineReader = createInterface({ input: terminalInput, output: SILENT_OUTPUT, terminal: true });
  try {
    return await lineReader.question('');
  } finally {
    lineReader.close();
    outputStream.write('\n');
  }
}
