import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const runCommand = promisify(execFile);
const PERFORMANCE_SCORE_MINIMUM = 0.95;
const LARGEST_CONTENTFUL_PAINT_LIMIT_MS = 2_000;
const TOTAL_BLOCKING_TIME_LIMIT_MS = 100;
const TOTAL_BYTE_WEIGHT_LIMIT = 350_000;
const REPORT_FILE = 'report.json';
const LIGHTHOUSE_BUFFER_BYTES = 64 * 1024 * 1024;

export enum FormFactor {
  Mobile = 'mobile',
  Desktop = 'desktop',
}

const auditSchema = z.object({ numericValue: z.number() });
const reportSchema = z.object({
  categories: z.object({ performance: z.object({ score: z.number() }) }),
  audits: z.object({
    'largest-contentful-paint': auditSchema,
    'cumulative-layout-shift': auditSchema,
    'total-blocking-time': auditSchema,
    'total-byte-weight': auditSchema,
  }),
});

export type LighthouseSummary = {
  performanceScore: number;
  largestContentfulPaintMs: number;
  cumulativeLayoutShift: number;
  totalBlockingTimeMs: number;
  totalByteWeight: number;
};

export function summaryOf(input: { report: unknown }): LighthouseSummary {
  const { categories, audits } = reportSchema.parse(input.report);
  return {
    performanceScore: categories.performance.score,
    largestContentfulPaintMs: audits['largest-contentful-paint'].numericValue,
    cumulativeLayoutShift: audits['cumulative-layout-shift'].numericValue,
    totalBlockingTimeMs: audits['total-blocking-time'].numericValue,
    totalByteWeight: audits['total-byte-weight'].numericValue,
  };
}

export function budgetViolationsOf(input: { summary: LighthouseSummary; formFactor: FormFactor }): string[] {
  const { summary } = input;
  const checks = [
    {
      isViolated: summary.performanceScore < PERFORMANCE_SCORE_MINIMUM,
      text: `performance score ${summary.performanceScore} is under ${PERFORMANCE_SCORE_MINIMUM}`,
    },
    {
      isViolated: summary.largestContentfulPaintMs >= LARGEST_CONTENTFUL_PAINT_LIMIT_MS,
      text: `largest contentful paint ${summary.largestContentfulPaintMs} ms is not under ${LARGEST_CONTENTFUL_PAINT_LIMIT_MS} ms`,
    },
    { isViolated: summary.cumulativeLayoutShift > 0, text: `cumulative layout shift ${summary.cumulativeLayoutShift} is not 0` },
    {
      isViolated: summary.totalBlockingTimeMs >= TOTAL_BLOCKING_TIME_LIMIT_MS,
      text: `total blocking time ${summary.totalBlockingTimeMs} ms is not under ${TOTAL_BLOCKING_TIME_LIMIT_MS} ms`,
    },
    {
      isViolated: summary.totalByteWeight > TOTAL_BYTE_WEIGHT_LIMIT,
      text: `total byte weight ${summary.totalByteWeight} is over ${TOTAL_BYTE_WEIGHT_LIMIT} bytes`,
    },
  ];
  return checks.filter((check) => check.isViolated).map((check) => `${input.formFactor}: ${check.text}`);
}

function lighthouseArguments(input: { url: string; formFactor: FormFactor; reportPath: string }): string[] {
  const presetArguments = input.formFactor === FormFactor.Desktop ? ['--preset=desktop'] : [];
  return [
    'lighthouse',
    input.url,
    ...presetArguments,
    '--only-categories=performance',
    '--output=json',
    `--output-path=${input.reportPath}`,
    '--chrome-flags=--headless=new',
    '--quiet',
  ];
}

async function measure(input: { url: string; formFactor: FormFactor }): Promise<LighthouseSummary> {
  const directory = await mkdtemp(join(tmpdir(), 'zapbip-lighthouse-'));
  const reportPath = join(directory, REPORT_FILE);
  await runCommand('npx', lighthouseArguments({ ...input, reportPath }), { maxBuffer: LIGHTHOUSE_BUFFER_BYTES });
  const summary = summaryOf({ report: JSON.parse(await readFile(reportPath, 'utf8')) });
  await rm(directory, { recursive: true, force: true });
  return summary;
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2);
  if (urls.length === 0) throw new Error('pass the URLs to measure: pnpm exec tsx apps/api/scripts/lighthouse-budget.ts <url>...');
  const runs = urls.flatMap((url) => Object.values(FormFactor).map((formFactor) => ({ url, formFactor })));
  const violations = await runs.reduce<Promise<string[]>>(async (previous, run) => {
    const found = await previous;
    const summary = await measure(run);
    console.log(JSON.stringify({ ...run, ...summary }));
    return [...found, ...budgetViolationsOf({ summary, formFactor: run.formFactor }).map((text) => `${run.url} ${text}`)];
  }, Promise.resolve([]));
  violations.forEach((text) => console.error(text));
  process.exit(violations.length === 0 ? 0 : 1);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
