export type BatchCounts = Record<string, number>;

const COUNT_SEPARATOR = ' ';

export function auditTargetOf(input: { counts: BatchCounts }): string {
  return Object.entries(input.counts)
    .map(([name, count]) => `${name}=${count}`)
    .join(COUNT_SEPARATOR);
}
