const LIST_PAGE_SIZE = 1_000;

export type MediaObjectSummary = { key: string; uploaded: Date };

export async function listMediaObjects(input: { bucket: Pick<R2Bucket, 'list'>; cursor?: string }): Promise<MediaObjectSummary[]> {
  const page = await input.bucket.list({ limit: LIST_PAGE_SIZE, cursor: input.cursor });
  const summaries = page.objects.map(({ key, uploaded }) => ({ key, uploaded }));
  if (!page.truncated) return summaries;
  return [...summaries, ...(await listMediaObjects({ bucket: input.bucket, cursor: page.cursor }))];
}
