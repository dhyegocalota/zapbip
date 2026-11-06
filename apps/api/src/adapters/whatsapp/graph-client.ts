export const GRAPH_NO_RESPONSE_STATUS = 0;

export type GraphClient = {
  post(input: { path: string; body: unknown }): Promise<unknown>;
  get(input: { path: string }): Promise<unknown>;
  download(input: { url: string }): Promise<Response>;
};

export function createGraphClient(input: { baseUrl: string; accessToken: string; fetcher: typeof fetch }): GraphClient {
  void input;
  throw new Error('createGraphClient is not implemented');
}
