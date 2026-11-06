import type { StoredMedia } from '../inbox-records';
import type { DescribeUploadInput } from './types';

export function describeUpload(input: DescribeUploadInput): Promise<StoredMedia> {
  void input;
  throw new Error('describeUpload is not implemented');
}
