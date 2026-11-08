import { vi } from 'vitest';

const MESSAGES_PATH_SUFFIX = '/messages';

export type GraphPost = { url: string; authorization: string | null; body: { to: string; text: { body: string } } };

export function recordGraphPosts(): GraphPost[] {
  const posts: GraphPost[] = [];
  const passthrough = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = String(request instanceof Request ? request.url : request);
    if (!url.endsWith(MESSAGES_PATH_SUFFIX)) return passthrough(request, init);
    const authorization = new Headers(init?.headers).get('authorization');
    posts.push({ url, authorization, body: JSON.parse(String(init?.body)) as GraphPost['body'] });
    return Response.json({ messages: [{ id: `wamid.NOTICE${posts.length}` }] });
  });
  return posts;
}
