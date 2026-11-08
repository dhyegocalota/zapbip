export type LeakAgent = { id: string; enumMember: string };
export type LeakFile = { path: string; text: string };

export function leakViolationsOf(input: { agents: LeakAgent[]; files: LeakFile[]; allowedPrefixes: string[] }): string[] {
  throw new Error(`leakViolationsOf is not implemented for ${input.agents.length} agents`);
}
