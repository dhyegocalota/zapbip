import { createInterface } from 'node:readline/promises';
import { CONNECTION_URL_VARIABLE } from '@zapbip/types';

export type HiddenPromptInput = {
  stdin: NodeJS.ReadStream;
  output: NodeJS.WritableStream;
  prompt: string;
};

const ENTER_CHARACTERS = ['\r', '\n'];
const BACKSPACE_CHARACTERS = ['\u007f', '\b'];
const INTERRUPT_CHARACTER = '\u0003';
const NEWLINE = '\n';
const CONNECTION_LINK_REQUIRED_MESSAGE = `a connection link is required: set ${CONNECTION_URL_VARIABLE} or type it at the prompt`;

async function readPlainLine(input: HiddenPromptInput): Promise<string> {
  const lineReader = createInterface({ input: input.stdin, output: input.output });
  const closed = new Promise<never>((_, reject) => lineReader.once('close', () => reject(new Error(CONNECTION_LINK_REQUIRED_MESSAGE))));
  const answer = await Promise.race([lineReader.question(input.prompt), closed]);
  lineReader.close();
  return answer;
}

function readWithoutEcho(input: HiddenPromptInput): Promise<string> {
  const { stdin, output, prompt } = input;
  return new Promise((resolve, reject) => {
    let typed = '';
    output.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    function finish(): void {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      output.write(NEWLINE);
    }

    function onCharacter(character: string): void {
      if (ENTER_CHARACTERS.includes(character)) {
        finish();
        return resolve(typed);
      }
      if (character === INTERRUPT_CHARACTER) {
        finish();
        return reject(new Error('interrupted'));
      }
      if (BACKSPACE_CHARACTERS.includes(character)) {
        typed = typed.slice(0, -1);
        return;
      }
      typed += character;
    }

    function onData(chunk: Buffer): void {
      [...chunk.toString()].forEach((character) => {
        if (stdin.listenerCount('data') === 0) return;
        onCharacter(character);
      });
    }

    stdin.on('data', onData);
  });
}

export function readHiddenLine(input: HiddenPromptInput): Promise<string> {
  if (!input.stdin.isTTY) return readPlainLine(input);
  return readWithoutEcho(input);
}
