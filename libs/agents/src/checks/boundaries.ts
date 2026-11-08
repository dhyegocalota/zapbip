export type BoundaryFile = { path: string; text: string };

export function boundaryViolationsOf(input: { files: BoundaryFile[] }): string[] {
  throw new Error(`boundaryViolationsOf is not implemented for ${input.files.length} files`);
}
