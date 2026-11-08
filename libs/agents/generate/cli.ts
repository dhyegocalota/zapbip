import { GenerationMode, pendingDeletionsOf, staleWritesOf, writePlan } from './write';
import { discoverAgents } from './discover';
import { planGeneratedFiles, type GenerationPlan } from './plan';
import { SUPPORTED_FOLDER } from './repository';
import { listSource, readSource } from './source';

enum CliMode {
  Generate = 'generate',
  Check = 'check',
  New = 'new',
  Mentions = 'mentions',
}

type CliHandler = (input: { argv: string[] }) => Promise<number>;

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;

async function planFromDisk(): Promise<GenerationPlan> {
  return planGeneratedFiles({ agents: discoverAgents({ roots: [SUPPORTED_FOLDER] }), readSource, listSource });
}

async function generate(): Promise<number> {
  const plan = await planFromDisk();
  writePlan({ plan, mode: GenerationMode.Write }).forEach((path) => console.log(`wrote ${path}`));
  plan.violations.forEach((violation) => console.error(violation));
  return plan.violations.length === 0 ? SUCCESS_EXIT_CODE : FAILURE_EXIT_CODE;
}

async function check(): Promise<number> {
  const plan = await planFromDisk();
  writePlan({ plan, mode: GenerationMode.Check }).forEach((problem) => console.log(problem));
  plan.violations.forEach((violation) => console.log(violation));
  const counts = [staleWritesOf({ plan }).length, pendingDeletionsOf({ plan }).length, plan.violations.length];
  console.log(`${counts[0]} stale, ${counts[1]} deletions, ${counts[2]} violations`);
  return counts.every((count) => count === 0) ? SUCCESS_EXIT_CODE : FAILURE_EXIT_CODE;
}

async function notImplemented(input: { mode: CliMode }): Promise<number> {
  throw new Error(`agents:${input.mode} is not implemented`);
}

const HANDLERS: Record<CliMode, CliHandler> = {
  [CliMode.Generate]: generate,
  [CliMode.Check]: check,
  [CliMode.New]: () => notImplemented({ mode: CliMode.New }),
  [CliMode.Mentions]: () => notImplemented({ mode: CliMode.Mentions }),
};

export async function runCli(input: { mode: string; argv: string[] }): Promise<void> {
  const handler = HANDLERS[input.mode as CliMode];
  if (!handler) throw new Error(`usage: agents:<${Object.values(CliMode).join('|')}>`);
  process.exitCode = await handler({ argv: input.argv });
}

await runCli({ mode: process.argv[2] as string, argv: process.argv.slice(3) });
