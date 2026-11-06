import type { StoredMedia } from '../inbox-records';
import type { ClaimUploadInput } from './types';

export async function claimUpload(_input: ClaimUploadInput): Promise<StoredMedia> {
  throw new Error('claimUpload is not implemented');
}
