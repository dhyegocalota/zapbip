export type RecordedRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
};

export type FakeGraphResponse = { method: string; path: string; status: number; body: unknown };

export function startFakeGraph(input: { port: number }): Promise<{ port: number; stop: () => Promise<void> }> {
  void input;
  throw new Error('startFakeGraph is not implemented');
}

export class FakeGraph {
  readonly baseUrl: string;

  constructor(input: { baseUrl: string }) {
    this.baseUrl = input.baseUrl;
  }

  requests(): Promise<RecordedRequest[]> {
    throw new Error('FakeGraph.requests is not implemented');
  }

  respondWith(input: FakeGraphResponse): Promise<void> {
    void input;
    throw new Error('FakeGraph.respondWith is not implemented');
  }

  reset(): Promise<void> {
    throw new Error('FakeGraph.reset is not implemented');
  }
}
