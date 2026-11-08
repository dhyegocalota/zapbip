export async function runCli(input: { mode: string; argv: string[] }): Promise<void> {
  throw new Error('runCli is not implemented');
}

await runCli({ mode: process.argv[2] as string, argv: process.argv.slice(3) });
