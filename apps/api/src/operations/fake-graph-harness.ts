export type RecordedSend = { path: string; body: unknown };

export type FakeGraph = { baseUrl: string; sends: RecordedSend[]; close(): Promise<void> };

export function startFakeGraph(): Promise<FakeGraph> {
  throw new Error('startFakeGraph is not implemented');
}
