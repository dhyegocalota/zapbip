import type { UsageRepository } from '../../operations/usage-repository';

export class D1UsageRepository implements UsageRepository {
  constructor(input: { database: D1Database }) {
    void input;
  }

  reportDay(input: { day: string; accountId: string; gigabyteSeconds: number }): Promise<void> {
    void input;
    throw new Error('D1UsageRepository.reportDay is not implemented');
  }

  readDayTotal(input: { day: string }): Promise<number> {
    void input;
    throw new Error('D1UsageRepository.readDayTotal is not implemented');
  }
}
