import { describe, expect, it } from 'vitest';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { isKnownMetricsNumber, MetricsPeriod, parseMetricsFilter } from '../../src/backoffice/metrics/metrics-filter';

const NUMBERS = [{ numberId: 'num_alpha', label: 'Alpha' }];
const INVALID_PERIODS = ['abc', '90', '', '7.0', '-7', '07'];
const UNKNOWN_NUMBERS = ['nope', 'num_alpha ', "num_alpha' OR 1=1"];

describe('metrics filter parsing', () => {
  it('uses thirty days and every number when nothing is asked', () => {
    expect(parseMetricsFilter({ numberId: undefined, period: undefined })).toEqual({
      filter: { numberId: null, period: MetricsPeriod.Month },
    });
  });

  it('treats an empty number as every number', () => {
    expect(parseMetricsFilter({ numberId: '', period: '7' })).toEqual({ filter: { numberId: null, period: MetricsPeriod.Week } });
  });

  it.each(INVALID_PERIODS)('refuses the period %j with a notice', (period) => {
    expect(parseMetricsFilter({ numberId: undefined, period })).toEqual({ notice: BackofficeNotice.MetricsPeriodInvalid });
  });
});

describe('metrics filter number', () => {
  it('knows the all numbers filter and a registered number', () => {
    expect(isKnownMetricsNumber({ filter: { numberId: null, period: MetricsPeriod.Month }, numbers: NUMBERS })).toBe(true);
    expect(isKnownMetricsNumber({ filter: { numberId: 'num_alpha', period: MetricsPeriod.Month }, numbers: NUMBERS })).toBe(true);
  });

  it.each(UNKNOWN_NUMBERS)('does not know %j', (numberId) => {
    expect(isKnownMetricsNumber({ filter: { numberId, period: MetricsPeriod.Month }, numbers: NUMBERS })).toBe(false);
  });
});
