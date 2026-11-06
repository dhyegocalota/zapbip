import type { CreateUploadInput, CreateUploadResult } from './types';

export function createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
  void input;
  throw new Error('createUpload is not implemented');
}
