export interface UsageRepository {
  reportDay(input: { day: string; accountId: string; gigabyteSeconds: number }): Promise<void>;
  readDayTotal(input: { day: string }): Promise<number>;
}
