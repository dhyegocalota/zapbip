export async function runListen(_input: {
  socketLink: string;
  write: (input: { line: string }) => void;
  signal: AbortSignal;
}): Promise<number> {
  throw new Error('runListen is not implemented');
}
