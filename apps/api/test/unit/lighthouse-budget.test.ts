import { describe, expect, it } from 'vitest';
import { budgetViolationsOf, FormFactor, summaryOf } from '../../scripts/lighthouse-budget';

const PASSING_REPORT = {
  categories: { performance: { score: 0.98 } },
  audits: {
    'largest-contentful-paint': { numericValue: 1_400 },
    'cumulative-layout-shift': { numericValue: 0 },
    'total-blocking-time': { numericValue: 30 },
    'total-byte-weight': { numericValue: 180_000 },
  },
};

function reportWith(input: { audit: string; numericValue: number }) {
  return { ...PASSING_REPORT, audits: { ...PASSING_REPORT.audits, [input.audit]: { numericValue: input.numericValue } } };
}

describe('summaryOf', () => {
  it('reads the score and the four audits from a Lighthouse report', () => {
    expect(summaryOf({ report: PASSING_REPORT })).toEqual({
      performanceScore: 0.98,
      largestContentfulPaintMs: 1_400,
      cumulativeLayoutShift: 0,
      totalBlockingTimeMs: 30,
      totalByteWeight: 180_000,
    });
  });

  it('refuses a report without the performance score', () => {
    expect(() => summaryOf({ report: { audits: PASSING_REPORT.audits } })).toThrow();
  });
});

describe('budgetViolationsOf', () => {
  it.each([FormFactor.Mobile, FormFactor.Desktop])('accepts a passing %s run', (formFactor) => {
    expect(budgetViolationsOf({ summary: summaryOf({ report: PASSING_REPORT }), formFactor })).toEqual([]);
  });

  it.each([
    ['largest-contentful-paint', 2_000, 'largest contentful paint'],
    ['cumulative-layout-shift', 0.01, 'cumulative layout shift'],
    ['total-blocking-time', 100, 'total blocking time'],
    ['total-byte-weight', 350_001, 'total byte weight'],
  ])('names %s when it is over its budget', (audit, numericValue, name) => {
    const violations = budgetViolationsOf({
      summary: summaryOf({ report: reportWith({ audit, numericValue }) }),
      formFactor: FormFactor.Mobile,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(name);
  });

  it('names the performance score when it is under 0.95', () => {
    const report = { ...PASSING_REPORT, categories: { performance: { score: 0.94 } } };
    expect(budgetViolationsOf({ summary: summaryOf({ report }), formFactor: FormFactor.Mobile })[0]).toContain('performance score');
  });
});
