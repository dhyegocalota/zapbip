import type { ReleaseUploadInput } from './types';

export async function releaseUpload(input: ReleaseUploadInput): Promise<void> {
  await input.dependencies.repository.releaseUpload({ mediaId: input.mediaId });
}
