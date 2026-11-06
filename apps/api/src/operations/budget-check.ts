import { isBudgetWarning, utcDay } from '../account-inbox/usage-meter';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import type { UsageRepository } from './usage-repository';

export async function runBudgetCheck(input: { repository: UsageRepository; now: number }): Promise<void> {
  const day = utcDay({ now: input.now });
  const gigabyteSeconds = await input.repository.readDayTotal({ day });
  if (!isBudgetWarning({ gigabyteSeconds })) return;
  logEvent({ event: LogEvent.BudgetWarning, day, gigabyteSeconds });
  throw new Error(`budget warning on ${day}: ${gigabyteSeconds} gigabyte seconds`);
}
