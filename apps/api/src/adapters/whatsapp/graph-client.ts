export const GRAPH_NO_RESPONSE_STATUS = 0;

export class GraphRequestError extends Error {
  readonly status: number;
  readonly errorCode: number | null;
  readonly errorTitle: string | null;

  constructor(input: { status: number; errorCode: number | null; errorTitle: string | null; message: string }) {
    super(input.message);
    this.status = input.status;
    this.errorCode = input.errorCode;
    this.errorTitle = input.errorTitle;
  }
}

export type GraphClient = {
  post(input: { path: string; body: unknown }): Promise<unknown>;
  get(input: { path: string }): Promise<unknown>;
  download(input: { url: string }): Promise<Response>;
};

export function createGraphClient(input: { baseUrl: string; accessToken: string; fetcher: typeof fetch }): GraphClient {
  void input;
  throw new Error('createGraphClient is not implemented');
}
