export type FakeRateLimiter = RateLimit & { calls: string[] };

export function createFakeRateLimiter(input: { limit: number }): FakeRateLimiter {
  const calls: string[] = [];
  return {
    calls,
    async limit({ key }: RateLimitOptions): Promise<RateLimitOutcome> {
      calls.push(key);
      const callsForKey = calls.filter((candidate) => candidate === key).length;
      return { success: callsForKey <= input.limit };
    },
  };
}
