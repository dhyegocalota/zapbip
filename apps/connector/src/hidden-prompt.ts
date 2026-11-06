export type HiddenPromptInput = {
  stdin: NodeJS.ReadStream;
  output: NodeJS.WritableStream;
  prompt: string;
};

export async function readHiddenLine(input: HiddenPromptInput): Promise<string> {
  void input;
  throw new Error('readHiddenLine is not implemented');
}
