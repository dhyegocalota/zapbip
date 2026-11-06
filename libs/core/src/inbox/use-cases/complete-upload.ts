import type { StoredMedia } from '../inbox-records';
import type { CompleteUploadInput } from './types';

export function completeUpload(input: CompleteUploadInput): Promise<StoredMedia> {
  void input;
  throw new Error('completeUpload is not implemented');
}
