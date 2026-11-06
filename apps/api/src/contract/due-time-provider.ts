export interface DueTimeProvider {
  nextDueAt(): Promise<number | null>;
  runDue(input: { now: number }): Promise<void>;
}
