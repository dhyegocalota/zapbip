import { z } from 'zod';
import { GRAPH_API_VERSION, GRAPH_REQUEST_TIMEOUT_MS, WHATSAPP_MEDIA_HOST_SUFFIXES } from './whatsapp-constants';

export const GRAPH_NO_RESPONSE_STATUS = 0;

const DOWNLOAD_PROTOCOL = 'https:';
const JSON_CONTENT_TYPE = 'application/json';

const graphErrorSchema = z.object({
  error: z.object({ code: z.number(), error_user_title: z.string().nullable().default(null) }),
});

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

function isAllowedMediaHost(input: { hostname: string }): boolean {
  return WHATSAPP_MEDIA_HOST_SUFFIXES.some((suffix) => input.hostname === suffix || input.hostname.endsWith(`.${suffix}`));
}

function assertDownloadUrl(input: { url: string }): void {
  if (!URL.canParse(input.url)) throw new Error('media download refused: the url is not valid');
  const { protocol, hostname } = new URL(input.url);
  if (protocol === DOWNLOAD_PROTOCOL && isAllowedMediaHost({ hostname })) return;
  throw new Error(`media download refused for host ${hostname}`);
}

async function failureOf(input: { response: Response }): Promise<GraphRequestError> {
  const { response } = input;
  const parsed = graphErrorSchema.safeParse(await response.json().catch(() => null));
  return new GraphRequestError({
    status: response.status,
    errorCode: parsed.success ? parsed.data.error.code : null,
    errorTitle: parsed.success ? parsed.data.error.error_user_title : null,
    message: `Graph request failed with status ${response.status}`,
  });
}

export function createGraphClient(input: { baseUrl: string; accessToken: string; fetcher: typeof fetch }): GraphClient {
  const { baseUrl, accessToken, fetcher } = input;
  const authorization = `Bearer ${accessToken}`;

  async function perform(request: { url: string; init: RequestInit }): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GRAPH_REQUEST_TIMEOUT_MS);
    try {
      return await fetcher(request.url, { ...request.init, signal: controller.signal });
    } catch (error) {
      throw new GraphRequestError({
        status: GRAPH_NO_RESPONSE_STATUS,
        errorCode: null,
        errorTitle: null,
        message: `Graph request got no response: ${error}`,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestJson(request: { path: string; init: RequestInit }): Promise<unknown> {
    const response = await perform({ url: `${baseUrl}/${GRAPH_API_VERSION}${request.path}`, init: request.init });
    if (!response.ok) throw await failureOf({ response });
    return response.json();
  }

  return {
    post({ path, body }) {
      return requestJson({
        path,
        init: { method: 'POST', headers: { authorization, 'content-type': JSON_CONTENT_TYPE }, body: JSON.stringify(body) },
      });
    },

    get({ path }) {
      return requestJson({ path, init: { method: 'GET', headers: { authorization } } });
    },

    async download({ url }) {
      assertDownloadUrl({ url });
      return perform({ url, init: { method: 'GET', headers: { authorization }, redirect: 'manual' } });
    },
  };
}
