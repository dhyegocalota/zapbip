export enum FormFactor {
  Mobile = 'mobile',
  Desktop = 'desktop',
}

export type LighthouseSummary = {
  performanceScore: number;
  largestContentfulPaintMs: number;
  cumulativeLayoutShift: number;
  totalBlockingTimeMs: number;
  totalByteWeight: number;
};

export function summaryOf(input: { report: unknown }): LighthouseSummary {
  throw new Error('summaryOf is not implemented');
}

export function budgetViolationsOf(input: { summary: LighthouseSummary; formFactor: FormFactor }): string[] {
  throw new Error('budgetViolationsOf is not implemented');
}
