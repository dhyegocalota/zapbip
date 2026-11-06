export type MediaObjectSummary = { key: string; uploaded: Date };

export function listMediaObjects(input: { bucket: Pick<R2Bucket, 'list'>; cursor?: string }): Promise<MediaObjectSummary[]> {
  void input;
  throw new Error('listMediaObjects is not implemented');
}
